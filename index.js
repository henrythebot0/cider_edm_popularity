class CiderEdmPopularityPlugin {
  constructor(env) {
    this.env = env;
  }

  async onReady() {
    this.env.logger?.info?.("[cider-edm-popularity] Backend ready");
  }

  async onRendererReady() {
    this.env.logger?.info?.("[cider-edm-popularity] Renderer ready; loading frontend");
    await this.env.utils.loadJSFrontend("index.frontend.js");
  }
}

module.exports = CiderEdmPopularityPlugin;
