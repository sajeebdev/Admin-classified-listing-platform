/**
 * Lifecycle status of a blog post. Deliberately simple — three states, no
 * separate moderation-status field like `Listing` has, since blog posts are
 * authored directly by staff, not submitted by end-users for review.
 */
export const BlogPostStatus = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const;

export type BlogPostStatus = (typeof BlogPostStatus)[keyof typeof BlogPostStatus];
