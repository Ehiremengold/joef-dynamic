/**
 * Max width of the centred page column. The public site and most portal pages
 * use `standard`; the staff section uses `wide` so its tables fit without
 * sideways scrolling, and passes it to the nav and footer so the edges line up.
 */
export const PAGE_WIDTH = {
  standard: "max-w-[1200px]",
  wide: "max-w-[1600px]",
} as const;
