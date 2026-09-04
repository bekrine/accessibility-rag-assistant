const issues = [
  {
    id: "PN-1001",
    title: "Button has insufficient color contrast",
    wcag: "1.4.3 Contrast (Minimum)",
    severity: "Low",
    status: "Open",
    page: "Dashboard",
    url: "/dashboard",
    description:
      "The button text and background colors do not provide sufficient contrast.",
    remediation:
      "Change the foreground or background colors so the contrast ratio meets the required WCAG level.",
  },

  {
    id: "PN-1002",
    title: "Image is missing alternative text",
    wcag: "1.1.1 Non-text Content",
    severity: "Medium",
    status: "Open",
    page: "Profile",
    url: "/profile",
    description:
      "An informative image does not have appropriate alternative text.",
    remediation:
      "Add meaningful alternative text that communicates the purpose of the image.",
  },

  {
    id: "PN-1003",
    title: "Form input has no accessible name",
    wcag: "4.1.2 Name, Role, Value",
    severity: "High",
    status: "Open",
    page: "Settings",
    url: "/settings",
    description:
      "The form input cannot be properly identified by assistive technologies.",
    remediation:
      "Provide an accessible name using a visible label or an appropriate ARIA labeling technique.",
  },

  {
    id: "PN-1005",
    title: "Keyboard focus is not visible",
    wcag: "2.4.7 Focus Visible",
    severity: "High",
    status: "In Progress",
    page: "Navigation",
    url: "/navigation",
    description:
      "Interactive elements do not provide a visible indicator when they receive keyboard focus.",
    remediation:
      "Provide a clearly visible focus indicator for keyboard users.",
  },

  {
    id: "PN-1006",
    title: "Link has no discernible name",
    wcag: "2.4.4 Link Purpose (In Context)",
    severity: "Medium",
    status: "Resolved",
    page: "Help",
    url: "/help",
    description:
      "A link does not have a name that communicates its purpose to assistive technology.",
    remediation:
      "Provide meaningful link text or an accessible name.",
  },
];

module.exports = issues;