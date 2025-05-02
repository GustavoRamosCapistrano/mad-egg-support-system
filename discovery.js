const services = {};

function registerService(name, port) {
  services[name] = { port, alive: true };
  console.log(`Registered ${name} on port ${port}`);
}

function discoverService(name) {
  return services[name] || null;
}

module.exports = { registerService, discoverService };