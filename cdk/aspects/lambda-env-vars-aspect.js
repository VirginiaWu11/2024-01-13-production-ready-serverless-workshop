const { Function } = require("aws-cdk-lib/aws-lambda");

class LambdaEnvVarsAspect {
  constructor(serviceName, stageName) {
    this.serviceName = serviceName;
    this.stageName = stageName;
  }

  visit(node) {
    if (node instanceof Function) {
      if (this.stageName === "prod") {
        node.addEnvironment("LOG_LEVEL", "info");
      } else {
        node.addEnvironment("LOG_LEVEL", "debug");
      }
      node.addEnvironment("serviceName", this.serviceName);
      node.addEnvironment("POWERTOOLS_LOGGER_SAMPLE_RATE", "0.1");
    }
  }
}

module.exports = { LambdaEnvVarsAspect };
