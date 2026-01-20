export interface Viewport {
  width: number;
  height: number;
}

export interface Profile {
  browser?: "chromium" | "firefox" | "webkit";
  executable?: string;
  headless?: boolean;
  viewport?: Viewport;
  args?: string[];
  locale?: string;
  timezone?: string;
  colorScheme?: "light" | "dark" | "no-preference";
  userAgent?: string;
  proxy?: string;
  ignoreHTTPSErrors?: boolean;
  offline?: boolean;
}

export const defaultProfile: Profile = {
  browser: "chromium",
  headless: true,
};
