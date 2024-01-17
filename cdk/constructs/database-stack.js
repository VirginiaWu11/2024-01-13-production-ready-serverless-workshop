const { Stack, RemovalPolicy } = require("aws-cdk-lib");
const {
  Table,
  AttributeType,
  BillingMode,
} = require("aws-cdk-lib/aws-dynamodb");

class DatabaseStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const restaurantstable = new Table(this, "RestaurantsTable", {
      partitionKey: {
        name: "name",
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.SNAPSHOT,
    });

    this.restaurantsTable = restaurantstable;
  }
}

module.exports = { DatabaseStack };
