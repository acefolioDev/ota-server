export function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function platformLabel(platform: string) {
  if (platform === "ios") return "iOS";
  if (platform === "android") return "Android";
  return platform;
}
