import { createSign } from "node:crypto";
import type { PlannedChange } from "./patch.js";

export type GithubOAuthProfile = {
  githubUserId: number;
  login: string;
  email?: string;
  avatarUrl?: string;
};

export interface GithubOAuthClient {
  exchangeCode(input: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<string>;
  getUser(accessToken: string): Promise<GithubOAuthProfile>;
}

// GitHub is used only to prove the human's identity. The returned GitHub token
// is deliberately short-lived in memory and is discarded after getUser().
export class GithubAppOAuthClient implements GithubOAuthClient {
  constructor(
    private readonly options: {
      clientId: string;
      clientSecret: string;
      apiBaseUrl?: string;
      oauthBaseUrl?: string;
    }
  ) {}

  async exchangeCode(input: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<string> {
    const response = await fetch(
      `${this.options.oauthBaseUrl ?? "https://github.com"}/login/oauth/access_token`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "user-agent": "oexl"
        },
        body: JSON.stringify({
          client_id: this.options.clientId,
          client_secret: this.options.clientSecret,
          code: input.code,
          redirect_uri: input.redirectUri,
          code_verifier: input.codeVerifier
        })
      }
    );
    const body = (await response.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };
    if (!response.ok || !body.access_token)
      throw Object.assign(
        new Error(body.error_description ?? "GitHub code exchange failed"),
        { code: "OEXL_AUTH_GITHUB_EXCHANGE_FAILED" }
      );
    return body.access_token;
  }

  async getUser(accessToken: string): Promise<GithubOAuthProfile> {
    const response = await fetch(
      `${this.options.apiBaseUrl ?? "https://api.github.com"}/user`,
      {
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: "application/vnd.github+json",
          "x-github-api-version": "2022-11-28",
          "user-agent": "oexl"
        }
      }
    );
    const body = (await response.json()) as {
      id?: number;
      login?: string;
      email?: string | null;
      avatar_url?: string | null;
      message?: string;
    };
    if (!response.ok || !body.id || !body.login)
      throw Object.assign(
        new Error(body.message ?? "GitHub identity lookup failed"),
        { code: "OEXL_AUTH_GITHUB_PROFILE_FAILED" }
      );
    return {
      githubUserId: body.id,
      login: body.login,
      ...(body.email ? { email: body.email } : {}),
      ...(body.avatar_url ? { avatarUrl: body.avatar_url } : {})
    };
  }
}

export type PullRequestTarget = {
  installationId: number;
  owner: string;
  repo: string;
};

// Narrow surface the publisher needs. A branch is pushed and a PR opened on the
// buyer's own repo; nothing is ever merged, force-pushed, or written to a
// default branch — the buyer's merge is the act of applying the deliverable.
export interface GithubRepoClient {
  readFile(
    target: PullRequestTarget,
    sha: string,
    path: string
  ): Promise<string | null>;
  openPullRequest(
    target: PullRequestTarget,
    input: {
      baseSha: string;
      branch: string;
      title: string;
      body: string;
      changes: PlannedChange[];
    }
  ): Promise<{ number: number; url: string }>;
  commentIssue(
    target: PullRequestTarget,
    issueNumber: number,
    body: string
  ): Promise<void>;
}

const base64url = (input: Buffer | string): string =>
  Buffer.from(input).toString("base64url");

// A real GitHub App installation client. Not exercised in the test suite (it
// needs a live App); the publisher is proven against a fake implementing the
// same interface. Kept dependency-free (App JWT signed with node:crypto).
export class GithubInstallationClient implements GithubRepoClient {
  private readonly appId: string;
  private readonly privateKey: string;
  private readonly api: string;
  private readonly now: () => number;
  private readonly tokenCache = new Map<
    number,
    { token: string; expiresAt: number }
  >();

  constructor(options: {
    appId: string;
    privateKey: string;
    apiBaseUrl?: string;
    now?: () => number;
  }) {
    this.appId = options.appId;
    this.privateKey = options.privateKey;
    this.api = options.apiBaseUrl ?? "https://api.github.com";
    this.now = options.now ?? (() => Date.now());
  }

  private appJwt(): string {
    const issued = Math.floor(this.now() / 1000) - 30;
    const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const payload = base64url(
      JSON.stringify({ iat: issued, exp: issued + 540, iss: this.appId })
    );
    const signature = createSign("RSA-SHA256")
      .update(`${header}.${payload}`)
      .sign(this.privateKey);
    return `${header}.${payload}.${base64url(signature)}`;
  }

  private async installationToken(installationId: number): Promise<string> {
    const cached = this.tokenCache.get(installationId);
    if (cached && cached.expiresAt > this.now() + 60_000) return cached.token;
    const response = await this.request(
      "POST",
      `/app/installations/${installationId}/access_tokens`,
      this.appJwt()
    );
    const body = (await response.json()) as {
      token: string;
      expires_at: string;
    };
    this.tokenCache.set(installationId, {
      token: body.token,
      expiresAt: Date.parse(body.expires_at)
    });
    return body.token;
  }

  private async request(
    method: string,
    path: string,
    auth: string,
    body?: unknown
  ): Promise<Response> {
    const response = await fetch(`${this.api}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${auth}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "oexl",
        ...(body !== undefined ? { "content-type": "application/json" } : {})
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
    if (!response.ok && response.status !== 404)
      throw Object.assign(
        new Error(`GitHub ${method} ${path} -> ${response.status}`),
        { code: "OEXL_GITHUB_API_ERROR" }
      );
    return response;
  }

  async readFile(
    target: PullRequestTarget,
    sha: string,
    path: string
  ): Promise<string | null> {
    const token = await this.installationToken(target.installationId);
    const response = await this.request(
      "GET",
      `/repos/${target.owner}/${target.repo}/contents/${encodeURIComponent(
        path
      )}?ref=${sha}`,
      token
    );
    if (response.status === 404) return null;
    const body = (await response.json()) as { content?: string };
    return body.content
      ? Buffer.from(body.content, "base64").toString("utf8")
      : "";
  }

  async openPullRequest(
    target: PullRequestTarget,
    input: {
      baseSha: string;
      branch: string;
      title: string;
      body: string;
      changes: PlannedChange[];
    }
  ): Promise<{ number: number; url: string }> {
    const token = await this.installationToken(target.installationId);
    const repo = `/repos/${target.owner}/${target.repo}`;
    const call = (method: string, path: string, body?: unknown) =>
      this.request(method, path, token, body);

    const repoInfo = (await (await call("GET", repo)).json()) as {
      default_branch: string;
    };
    const baseCommit = (await (
      await call("GET", `${repo}/git/commits/${input.baseSha}`)
    ).json()) as { tree: { sha: string } };

    const tree: Array<Record<string, unknown>> = [];
    for (const change of input.changes) {
      if (change.kind === "delete") {
        tree.push({
          path: change.path,
          mode: "100644",
          type: "blob",
          sha: null
        });
        continue;
      }
      const blob = (await (
        await call("POST", `${repo}/git/blobs`, {
          content: change.content,
          encoding: "utf-8"
        })
      ).json()) as { sha: string };
      tree.push({
        path: change.path,
        mode: "100644",
        type: "blob",
        sha: blob.sha
      });
    }

    const newTree = (await (
      await call("POST", `${repo}/git/trees`, {
        base_tree: baseCommit.tree.sha,
        tree
      })
    ).json()) as { sha: string };
    const commit = (await (
      await call("POST", `${repo}/git/commits`, {
        message: input.title,
        tree: newTree.sha,
        parents: [input.baseSha]
      })
    ).json()) as { sha: string };
    await call("POST", `${repo}/git/refs`, {
      ref: `refs/heads/${input.branch}`,
      sha: commit.sha
    });
    const pr = (await (
      await call("POST", `${repo}/pulls`, {
        title: input.title,
        head: input.branch,
        base: repoInfo.default_branch,
        body: input.body
      })
    ).json()) as { number: number; html_url: string };
    return { number: pr.number, url: pr.html_url };
  }

  async commentIssue(
    target: PullRequestTarget,
    issueNumber: number,
    body: string
  ): Promise<void> {
    const token = await this.installationToken(target.installationId);
    await this.request(
      "POST",
      `/repos/${target.owner}/${target.repo}/issues/${issueNumber}/comments`,
      token,
      { body }
    );
  }
}
