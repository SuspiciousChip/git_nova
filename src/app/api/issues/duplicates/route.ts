import { createDuplicateDetectorHandler } from "@/lib/duplicate-detector";

export const runtime = "nodejs";
export const maxDuration = 120;
export const POST = createDuplicateDetectorHandler();
