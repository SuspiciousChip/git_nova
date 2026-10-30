import { createIssueFinderHandler } from "@/lib/issue-finder";

export const runtime = "nodejs";
export const maxDuration = 120;
export const POST = createIssueFinderHandler();
