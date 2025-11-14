const BOT_UA_REGEX =
  /(bot|crawl|spider|slurp|mediapartners|google|bingpreview|yandex|baiduspider|duckduckbot|sogou|exabot|facebot|facebookexternalhit|ia_archiver|twitterbot|pinterest|embedly|quora link preview|slackbot|vkshare|linkedinbot)/i;

export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) {
    return false;
  }
  return BOT_UA_REGEX.test(userAgent);
}

