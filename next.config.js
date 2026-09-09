/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Prevents the site being embedded in an iframe on another domain —
          // the classic defence against clickjacking (e.g. an invisible
          // overlay on a phishing page tricking someone into clicking a
          // button that's actually your login/PIN form underneath).
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Stops browsers from guessing/overriding a file's declared
          // content type, closing off a class of content-sniffing attacks.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Limits how much referrer information leaks to other sites when
          // someone clicks a link away from here.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Disables powerful browser features this app has no legitimate
          // use for, so they can't be abused if a page is ever compromised.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};
