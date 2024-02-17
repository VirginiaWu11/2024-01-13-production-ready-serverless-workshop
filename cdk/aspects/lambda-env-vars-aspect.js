const { Function } = require("aws-cdk-lib/aws-lambda");

class LambdaEnvVarsAspect {
  constructor(serviceName) {
    this.serviceName = serviceName;
  }

  visit(node) {
    if (node instanceof Function) {
      node.addEnvironment("LOG_LEVEL", "debug");
      node.addEnvironment("serviceName", this.serviceName);
    }
  }
}

module.exports = { LambdaEnvVarsAspect };
