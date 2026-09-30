# LabelVerify

LabelVerify is an AI-assisted prototype for reviewing alcohol beverage labels against application data. It was developed as a take-home project based on a hypothetical TTB label-review workflow.

The application helps a reviewer quickly identify routine matches, clear discrepancies, and fields that require human judgment. It does **not** make a final regulatory approval decision.

## Features

### Single Label Review

A reviewer enters application information and uploads label artwork. LabelVerify uses vision-capable AI to extract visible information from the label and compares it with the submitted application data.

The review covers:

- Brand name
- Class / type
- Alcohol content
- Net contents
- Producer / bottler name and address
- Required field of vision for brand name, class/type, and alcohol content
- Country of origin when applicable
- Government health warning
- Label image quality

Each comparison is classified as:

- **Match** — application and detected label information agree
- **Review** — information is ambiguous, incomplete, unreadable, or requires human judgment
- **Mismatch** — a material discrepancy was detected

The overall result is shown as **Pass**, **Review**, or **Issues**.

### Batch Review

LabelVerify also supports batch processing for higher-volume workflows. A reviewer can upload a CSV containing application information, upload the corresponding label images, process multiple applications, see batch progress and summary counts, and drill into individual exceptions.

The prototype processes up to four labels concurrently.

## Design Approach

The application separates AI extraction from comparison logic.

### AI extraction

The vision model examines uploaded artwork and returns structured observations about visible label content, government warning text, image quality, and whether brand name, class/type, and alcohol content appear together in the same field of vision.

### Deterministic comparison

Application code compares those observations with application data and assigns Match, Review, or Mismatch statuses.

The model is instructed to extract evidence rather than make a regulatory approval decision. Ambiguous cases are surfaced for human review rather than automatically accepted or rejected.

For example, a label containing a more specific class designation than the application can be routed to **Review** instead of being treated as an automatic failure.

## Performance

The interface reports actual server-side analysis time for each review.

During prototype testing, typical single-label analyses completed in approximately 3–5 seconds. Actual performance varies with image complexity, network conditions, and AI API latency.

## Technology

- Next.js
- React
- TypeScript
- Tailwind CSS
- OpenAI vision-capable API
- Zod
- Vercel

## Running Locally

### Requirements

- Node.js
- npm
- OpenAI API key

### Installation

Clone the repository:

    git clone https://github.com/kavyayenigalla09/labelverify.git
    cd labelverify

Install dependencies:

    npm install

Create a file named `.env.local` in the project root containing:

    OPENAI_API_KEY=your_api_key_here

Start the development server:

    npm run dev

Then open `http://localhost:3000`.

## Production Build

Run:

    npm run lint
    npm run build
    npm start

## Batch CSV Format

Required columns:

    filename,brandName,classType,alcoholContent,netContents,producer

Optional columns:

    countryOfOrigin

The `filename` value must correspond to one of the uploaded label image filenames.

A CSV template can also be downloaded from the Batch Review screen.

## Government Warning Review

The prototype checks whether the government health warning:

- Is present
- Matches the expected wording
- Uses an uppercase `GOVERNMENT WARNING:` heading
- Appears to use a bold heading

Because visual characteristics and poor-quality artwork can be uncertain, ambiguous observations can be routed to human review.

## Error Handling

The application handles common prototype failure conditions including:

- Missing label artwork
- Missing application information
- Invalid application data
- Unsupported image types
- Oversized image uploads
- AI/API failures
- Poor or unreadable artwork
- Missing images in batch submissions

## Security and Data Handling

This prototype intentionally does not include persistent document storage or a database.

Uploaded artwork is processed for the verification request and is not intentionally persisted by the application.

The OpenAI API key is used only by the server-side API route and is stored as an environment variable. It is not exposed to the browser or committed to source control.

For a production government environment, additional work would be required around authentication, authorization, audit logging, approved infrastructure, document retention, PII handling, network controls, monitoring, and applicable security requirements.

## Deployed Application

Production prototype:

    https://labelverify-phi.vercel.app/

## Assumptions and Scope

This prototype demonstrates the review workflow rather than reproducing the complete COLA regulatory system.

The implemented review is centered on common distilled-spirits label requirements and the workflow described in the project brief. It is not intended to represent exhaustive regulatory validation for every distilled-spirits category, wine, or malt beverages. A production implementation would extend the rules engine for beverage-specific and conditional disclosures, typography and placement requirements, regulatory rule versioning, security controls, and COLA integration.

Country of origin is treated as an optional comparison field for situations where it is applicable.

The prototype does not integrate with COLA or other TTB systems.

## Production Evolution

A production implementation could extend the prototype with:

- Integration with the existing application system
- Authentication and role-based access
- Audit trails and reviewer dispositions
- Durable batch-processing queues
- Persistent review history
- Regulatory rule versioning
- Evidence-region highlighting
- Operational monitoring
- Approved cloud/network architecture
- Formal model and extraction evaluation

## Human Review Philosophy

LabelVerify is decision support, not an automated regulatory decision-maker.

Its goal is to reduce time spent on routine visual comparison while making uncertainty obvious. Ambiguous or unreadable information is deliberately surfaced for human judgment rather than hidden behind an automated approval decision.
