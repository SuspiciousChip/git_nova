import { createPullRequestReviewHandler } from "@/lib/pr-review";

export const runtime = "nodejs";
export const maxDuration = 120;
export const POST = createPullRequestReviewHandler();
