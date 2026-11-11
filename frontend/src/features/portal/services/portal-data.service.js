import { getPortalModuleData, portalModuleNames } from "../data/portal-demo-data.js"

export const portalDataModes = Object.freeze(["demo", "api"])

export function createPortalDemoProvider() {
  return Object.freeze({
    getPortalSnapshot: async (moduleName, role) => ({
      ...getPortalModuleData(moduleName, role),
      mode: "demo",
    }),
  })
}

const roles = new Set([
  "MEMBER",
  "PRESIDENT",
  "SECRETARY",
  "TREASURER",
  "PLATFORM_ADMIN",
])

const modulesByRole = Object.freeze({
  MEMBER: portalModuleNames,
  PRESIDENT: portalModuleNames,
  SECRETARY: ["groups", "membership", "notifications", "reports"],
  TREASURER: ["groups", "savings", "loans", "repayments", "transactions", "notifications", "reports"],
  PLATFORM_ADMIN: portalModuleNames,
})

export function createPortalDataService({
  providers = { demo: createPortalDemoProvider() },
} = {}) {
  if (!providers || typeof providers !== "object" || Array.isArray(providers)) {
    throw new TypeError("Portal data providers are required.")
  }

  async function getModuleSnapshot(role, moduleName, {
    mode = "demo",
    token,
    signal,
  } = {}) {
    if (!roles.has(role)) {
      throw new TypeError("Unsupported SHGT workspace role.")
    }
    if (!modulesByRole[role].includes(moduleName)) {
      throw new TypeError("This workspace role cannot view the requested module.")
    }

    if (!portalDataModes.includes(mode)) {
      throw new TypeError("Unsupported portal data mode.")
    }

    const provider = providers[mode]
    if (!provider || typeof provider.getPortalSnapshot !== "function") {
      throw new Error(`The ${mode} portal data provider is not configured.`)
    }

    const snapshot = await provider.getPortalSnapshot(moduleName, role, {
      token,
      signal,
    })
    const apiResourcesValid = mode !== "api" || (
      snapshot?.resources &&
      typeof snapshot.resources === "object" &&
      !Array.isArray(snapshot.resources) &&
      Object.values(snapshot.resources).every((resource) =>
        resource &&
        (resource.status === "unavailable"
          ? typeof resource.message === "string" && resource.message.length > 0
          : resource.status === "available" && Array.isArray(resource.records))
      )
    )
    if (
      !snapshot ||
      snapshot.moduleName !== moduleName ||
      snapshot.mode !== mode ||
      (mode === "demo" && snapshot.demoOnly !== true) ||
      (mode === "api" && (snapshot.demoOnly !== false || !apiResourcesValid))
    ) {
      throw new Error(`Portal provider returned an invalid ${mode} snapshot.`)
    }

    return snapshot
  }

  function getAvailableModules(role) {
    if (!roles.has(role)) {
      throw new TypeError("Unsupported SHGT workspace role.")
    }
    return modulesByRole[role]
  }

  return Object.freeze({
    getModuleSnapshot,
    getAvailableModules,
    getAvailableModes: () => portalDataModes,
  })
}

export const portalDataService = createPortalDataService()
