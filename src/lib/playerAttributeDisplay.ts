type AttributeBarVariant = "success" | "accent" | "danger";

interface AttributeColors {
  barVariant: AttributeBarVariant;
  textClass: string;
}

/** Returns bar variant and text class from a single threshold table (70/40), matching ProgressBar's "auto" thresholds. */
export function getAttributeColors(value: number): AttributeColors {
  if (value >= 70) {
    return { barVariant: "success", textClass: "text-positive" };
  }
  if (value >= 40) {
    return { barVariant: "accent", textClass: "text-warning" };
  }
  return { barVariant: "danger", textClass: "text-danger" };
}

export function getAttributeValueClassName(value: number): string {
  return getAttributeColors(value).textClass;
}
