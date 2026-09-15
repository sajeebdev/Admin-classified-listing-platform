import sanitizeHtml from "sanitize-html";

/**
 * The single allowlist/sanitizer for a listing's rich-text description —
 * shared by the backend (authoritative sanitization at create/update time,
 * see `listing.validation.ts`) and the frontend's listing detail page
 * (defense-in-depth, and the only thing that makes rendering *pre-existing*
 * plain-text descriptions via `dangerouslySetInnerHTML` safe without a
 * migration — see docs/listings.md). Both call this exact function; there
 * is no second, competing sanitization implementation anywhere.
 *
 * The allowlist matches exactly what the editor (`RichTextEditor.tsx`,
 * TipTap's StarterKit configured with only paragraph/bold/italic/
 * underline/heading(2-3)/bulletList/orderedList/link/hardBreak) can ever
 * actually produce — nothing else is a legitimate output of the editor, so
 * nothing else needs to survive sanitization.
 */
const ALLOWED_TAGS = ["p", "br", "strong", "em", "u", "h2", "h3", "ul", "ol", "li", "a"];

const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  a: ["href", "rel", "target"],
};

// Only http/https — explicitly never javascript:, data:, vbscript:, or any
// other executable/pseudo-protocol. `allowProtocolRelative: false` closes
// the `//evil.example.com`-style bypass some sanitizers miss.
const ALLOWED_SCHEMES = ["http", "https"];

export function sanitizeListingDescriptionHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ALLOWED_SCHEMES,
    allowProtocolRelative: false,
    // Belt-and-braces beyond the tag allowlist itself: strips any
    // `<script>`/`<style>` content entirely rather than merely unwrapping
    // the tag and leaving its text content behind.
    disallowedTagsMode: "discard",
    nonTextTags: ["script", "style"],
    // Same convention `lib/utils/markdown.ts` already uses for blog post
    // links — this is user-authored content the site doesn't vouch for, so
    // every outbound link opens safely regardless of what the editor itself
    // set: `noopener` closes the `window.opener` reverse-tabnabbing vector,
    // `noreferrer` drops the referrer, `nofollow` is the expected signal
    // for user-generated content. Re-declaring `target`/`rel` in
    // `allowedAttributes` above is required — sanitize-html re-applies the
    // attribute allowlist after a transform runs.
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer nofollow" }),
    },
    // Nothing here ever needs a `class`/`style`/`id` — the detail page's
    // own typography classes (see `app/listings/[slug]/page.tsx`) apply to
    // the wrapping element, not to individual tags inside the description.
  });
}
