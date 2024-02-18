const {
  EventBridgeClient,
  PutEventsCommand,
} = require("@aws-sdk/client-eventbridge");
const eventBridge = new EventBridgeClient();
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");
const sns = new SNSClient();
const { makeIdempotent } = require("@aws-lambda-powertools/idempotency");
const {
  DynamoDBPersistenceLayer,
} = require("@aws-lambda-powertools/idempotency/dynamodb");
const {
  Logger,
  injectLambdaContext,
} = require("@aws-lambda-powertools/logger");
const middy = require("@middy/core");

const logger = new Logger({ serviceName: process.env.service_name });

const busName = process.env.bus_name;
const topicArn = process.env.restaurant_notification_topic;

const persistenceStore = new DynamoDBPersistenceLayer({
  tableName: process.env.idempotency_table,
});

const handler = async (event) => {
  logger.refreshSampleRateCalculation();
  const order = event.detail;
  const publishCmd = new PublishCommand({
    Message: JSON.stringify(order),
    TopicArn: topicArn,
  });
  await sns.send(publishCmd);

  const { restaurantName, orderId } = order;
  logger.debug(`notified restaurant with order`, {
    restaurantName,
    orderId,
  });

  const putEventsCmd = new PutEventsCommand({
    Entries: [
      {
        Source: "big-mouth",
        DetailType: "restaurant_notified",
        Detail: JSON.stringify(order),
        EventBusName: busName,
      },
    ],
  });
  await eventBridge.send(putEventsCmd);

  logger.debug(`published event into EventBridge`, {
    eventType: "restaurant_notified",
    busName,
  });

  return orderId;
};

module.exports.handler = middy(
  makeIdempotent(handler, { persistenceStore })
).use(injectLambdaContext(logger));
