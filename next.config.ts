import type { NextConfig } from "next";

const githubRepository = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const githubOwner = process.env.GITHUB_REPOSITORY_OWNER ?? "";
const isGithubPages = process.env.GITHUB_PAGES === "true";
const githubBasePath =
  isGithubPages &&
  githubRepository &&
  !githubRepository.endsWith(".github.io")
    ? `/${githubRepository}`
    : "";
const githubSiteUrl =
  githubOwner && isGithubPages
    ? `https://${githubOwner}.github.io${githubBasePath}`
    : "";
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  githubSiteUrl ||
  "http://localhost:3000";

const nextConfig: NextConfig = {
  output: isGithubPages ? "export" : undefined,
  basePath: githubBasePath,
  assetPrefix: githubBasePath,
  trailingSlash: isGithubPages,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: githubBasePath,
    NEXT_PUBLIC_SITE_URL: siteUrl,
  },
};

export default nextConfig;
