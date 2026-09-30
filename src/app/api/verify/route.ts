import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const LabelAnalysisSchema = z.object({
  imageQuality: z.enum(["good", "acceptable", "poor"]),
  imageQualityNotes: z.string(),

  extracted: z.object({
    brandName: z.string().nullable(),
    classType: z.string().nullable(),
    alcoholContent: z.string().nullable(),
    netContents: z.string().nullable(),
    producer: z.string().nullable(),
    countryOfOrigin: z.string().nullable(),
    governmentWarningText: z.string().nullable(),
  }),

  fieldOfVision: z.object({
    brandClassAlcoholTogether: z.enum(["yes", "no", "unclear"]),
    notes: z.string(),
  }),

  warning: z.object({
    present: z.boolean(),
    exactWording: z.boolean(),
    headingUppercase: z.boolean(),
    headingAppearsBold: z.boolean(),
    notes: z.string(),
  }),

  notes: z.array(z.string()),
});

type LabelAnalysis = z.infer<typeof LabelAnalysisSchema>;

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9%.'\/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeBrand(value: string | null | undefined) {
  return normalizeText(value)
    .replace(/[.'"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractNumber(value: string | null | undefined) {
  if (!value) return null;
  const match = value.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function meaningfulWords(value: string) {
  return value
    .split(" ")
    .map((word) => word.trim())
    .filter((word) => word.length > 1);
}

function compareText(
  expected: string,
  detected: string | null,
  kind: "brand" | "text" | "producer" = "text"
) {
  if (!detected) {
    return {
      status: "review" as const,
      reason: "Could not confidently read this field from the label.",
    };
  }

  const left =
    kind === "brand" ? normalizeBrand(expected) : normalizeText(expected);
  const right =
    kind === "brand" ? normalizeBrand(detected) : normalizeText(detected);

  if (left === right) {
    return {
      status: "match" as const,
      reason: "Application and label values match.",
    };
  }

  // Brand and producer fields frequently contain harmless formatting
  // differences or additional address/detail text on the physical label.
  if (kind === "brand" || kind === "producer") {
    if (left.length >= 3 && (right.includes(left) || left.includes(right))) {
      return {
        status: "match" as const,
        reason:
          kind === "producer"
            ? "Producer name matches; the label contains additional identifying or address information."
            : "Brand names are equivalent after normalization.",
      };
    }
  }

  // For descriptive fields such as class/type, a label may contain a more
  // specific designation than the application value. That requires agent
  // judgment rather than being treated automatically as a contradiction.
  if (kind === "text") {
    const leftWords = meaningfulWords(left);
    const rightWords = meaningfulWords(right);

    const leftContained =
      leftWords.length > 0 &&
      leftWords.every((word) => rightWords.includes(word));

    const rightContained =
      rightWords.length > 0 &&
      rightWords.every((word) => leftWords.includes(word));

    if (leftContained || rightContained) {
      return {
        status: "review" as const,
        reason:
          "The values overlap, but one is more specific than the other. Agent review is recommended.",
      };
    }
  }

  return {
    status: "mismatch" as const,
    reason: "Application and label values differ.",
  };
}

function compareNumeric(expected: string, detected: string | null) {
  const left = extractNumber(expected);
  const right = extractNumber(detected);

  if (right === null) {
    return {
      status: "review" as const,
      reason: "Could not confidently read this value from the label.",
    };
  }

  if (left !== null && Math.abs(left - right) < 0.001) {
    return {
      status: "match" as const,
      reason: "Numeric values match.",
    };
  }

  return {
    status: "mismatch" as const,
    reason: "Numeric values differ.",
  };
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is not configured.");

      return NextResponse.json(
        { error: "AI verification is temporarily unavailable." },
        { status: 503 }
      );
    }

    const formData = await request.formData();

    const image = formData.get("image");
    const applicationRaw = formData.get("application");

    if (!(image instanceof File)) {
      return NextResponse.json(
        { error: "A label image is required." },
        { status: 400 }
      );
    }

    if (typeof applicationRaw !== "string") {
      return NextResponse.json(
        { error: "Application information is required." },
        { status: 400 }
      );
    }

    if (!image.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "The uploaded file must be an image." },
        { status: 400 }
      );
    }

    if (image.size > 12 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Image is too large. Please upload an image under 12 MB." },
        { status: 400 }
      );
    }

    let application: {
      brandName: string;
      classType: string;
      alcoholContent: string;
      netContents: string;
      producer?: string;
      countryOfOrigin?: string;
    };

    try {
      application = JSON.parse(applicationRaw);
    } catch {
      return NextResponse.json(
        { error: "Application information is invalid." },
        { status: 400 }
      );
    }

    if (
      !application.brandName?.trim() ||
      !application.classType?.trim() ||
      !application.alcoholContent?.trim() ||
      !application.netContents?.trim() ||
      !application.producer?.trim()
    ) {
      return NextResponse.json(
        { error: "Required application information is incomplete." },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await image.arrayBuffer());
    const dataUrl = `data:${image.type};base64,${bytes.toString("base64")}`;

    const response = await client.responses.create({
      model: "gpt-5-mini",
      reasoning: { effort: "minimal" },
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: `You are an evidence-extraction assistant for an alcohol beverage label review prototype.

Your job is to inspect the supplied label image and report only what is visibly supported by the image.

IMPORTANT RULES:
- Do not decide whether the product should receive regulatory approval.
- Do not invent or infer text that is unreadable.
- If a field cannot be read confidently, return null.
- Preserve detected wording as closely as possible.
- Brand-name capitalization differences alone are not meaningful.
- For alcohol content, extract the visible ABV/Alc./Vol. expression, including proof if visible.
- For net contents, extract the visible quantity and unit.
- For producer/bottler and country of origin, return only text actually visible.
- Determine whether the brand name, class/type designation, and alcohol content are displayed together in the same field of vision (the same label panel/view without turning the container). Return "yes" only when the image clearly supports this, "no" when they are clearly separated across different fields of vision, and "unclear" when image composition, cropping, angle, or multiple photographed panels prevents a confident determination.
- Inspect the government health warning carefully.
- Determine whether "GOVERNMENT WARNING:" is visibly uppercase.
- Determine whether the heading appears visually bold relative to the warning body.
- exactWording should only be true if the visible warning matches the standard federal warning below in substance and wording, allowing inconsequential whitespace/punctuation caused by image reading.

STANDARD WARNING:
GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.

Image quality:
- good: relevant label text is clear and readily readable.
- acceptable: some degradation, angle, glare, or small text exists, but key fields remain readable.
- poor: important information cannot be read reliably.

Return JSON only.`,
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Application information supplied for comparison context:
${JSON.stringify(application, null, 2)}

Analyze the uploaded LABEL IMAGE. Do not copy application values into extracted fields unless they are actually visible in the image.

Return exactly this JSON shape:
{
  "imageQuality": "good" | "acceptable" | "poor",
  "imageQualityNotes": "string",
  "extracted": {
    "brandName": "string or null",
    "classType": "string or null",
    "alcoholContent": "string or null",
    "netContents": "string or null",
    "producer": "string or null",
    "countryOfOrigin": "string or null",
    "governmentWarningText": "string or null"
  },
  "fieldOfVision": {
    "brandClassAlcoholTogether": "yes" | "no" | "unclear",
    "notes": "string"
  },
  "warning": {
    "present": true | false,
    "exactWording": true | false,
    "headingUppercase": true | false,
    "headingAppearsBold": true | false,
    "notes": "string"
  },
  "notes": ["string"]
}`,
            },
            {
              type: "input_image",
              image_url: dataUrl,
              detail: "high",
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_object",
        },
      },
    });

    const parsed = LabelAnalysisSchema.parse(
      JSON.parse(response.output_text)
    ) as LabelAnalysis;

    const checks = [
      {
        id: "brandName",
        label: "Brand Name",
        expected: application.brandName,
        detected: parsed.extracted.brandName,
        ...compareText(
          application.brandName,
          parsed.extracted.brandName,
          "brand"
        ),
      },
      {
        id: "classType",
        label: "Class / Type",
        expected: application.classType,
        detected: parsed.extracted.classType,
        ...compareText(application.classType, parsed.extracted.classType),
      },
      {
        id: "alcoholContent",
        label: "Alcohol Content",
        expected: application.alcoholContent,
        detected: parsed.extracted.alcoholContent,
        ...compareNumeric(
          application.alcoholContent,
          parsed.extracted.alcoholContent
        ),
      },
      {
        id: "netContents",
        label: "Net Contents",
        expected: application.netContents,
        detected: parsed.extracted.netContents,
        ...compareNumeric(application.netContents, parsed.extracted.netContents),
      },
    ];

    checks.push({
      id: "producer",
      label: "Bottler / Producer",
      expected: application.producer,
      detected: parsed.extracted.producer,
      ...compareText(
        application.producer,
        parsed.extracted.producer,
        "producer"
      ),
    });

    if (application.countryOfOrigin?.trim()) {
      checks.push({
        id: "countryOfOrigin",
        label: "Country of Origin",
        expected: application.countryOfOrigin,
        detected: parsed.extracted.countryOfOrigin,
        ...compareText(
          application.countryOfOrigin,
          parsed.extracted.countryOfOrigin
        ),
      });
    }

    const fieldOfVisionStatus: "match" | "mismatch" | "review" =
      parsed.fieldOfVision.brandClassAlcoholTogether === "yes"
        ? "match"
        : parsed.fieldOfVision.brandClassAlcoholTogether === "no"
          ? "mismatch"
          : "review";

    const fieldOfVision = {
      status: fieldOfVisionStatus,
      reason:
        parsed.fieldOfVision.notes ||
        (fieldOfVisionStatus === "match"
          ? "Brand name, class/type, and alcohol content appear together."
          : fieldOfVisionStatus === "mismatch"
            ? "Required information appears across different fields of vision."
            : "The field-of-vision requirement could not be verified confidently."),
    };

    const warningChecks = [
      {
        label: "Warning present",
        status: parsed.warning.present ? "match" : "mismatch",
      },
      {
        label: "Standard warning wording",
        status: parsed.warning.exactWording
          ? "match"
          : parsed.warning.present
            ? "mismatch"
            : "review",
      },
      {
        label: "Heading uppercase",
        status: parsed.warning.headingUppercase ? "match" : "mismatch",
      },
      {
        label: "Heading appears bold",
        status: parsed.warning.headingAppearsBold ? "match" : "review",
      },
    ];

    const allStatuses = [
      ...checks.map((check) => check.status),
      ...warningChecks.map((check) => check.status),
      fieldOfVision.status,
    ];

    let overallStatus: "pass" | "review" | "fail" = "pass";

    if (allStatuses.includes("mismatch")) {
      overallStatus = "fail";
    } else if (
      allStatuses.includes("review") ||
      parsed.imageQuality === "poor"
    ) {
      overallStatus = "review";
    }

    return NextResponse.json({
      overallStatus,
      processingTimeMs: Date.now() - startedAt,
      imageQuality: parsed.imageQuality,
      imageQualityNotes: parsed.imageQualityNotes,
      checks,
      fieldOfVision,
      warning: {
        ...parsed.warning,
        checks: warningChecks,
      },
      extracted: parsed.extracted,
      notes: parsed.notes,
    });
  } catch (error) {
    console.error("Verification error:", error);

    return NextResponse.json(
      {
        error:
          "The label could not be analyzed. Please try again or use a clearer image.",
      },
      { status: 500 }
    );
  }
}
