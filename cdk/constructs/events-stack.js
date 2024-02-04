const { Stack, CfnCondition, Duration, Fn, CfnOutput } = require("aws-cdk-lib");
const { EventBus, Rule } = require("aws-cdk-lib/aws-events");
const { LambdaFunction } = require("aws-cdk-lib/aws-events-targets");
const { Topic, Subscription } = require("aws-cdk-lib/aws-sns");
const { Function, Code, Runtime } = require("aws-cdk-lib/aws-lambda");
const { Queue } = require("aws-cdk-lib/aws-sqs");
const { PolicyStatement, ServicePrincipal } = require("aws-cdk-lib/aws-iam");

class EventsStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const orderEventBus = new EventBus(this, "OrderEventBus", {
      eventBusName: `${props.serviceName}-${props.stageName}-order-events`,
    });

    this.orderEventBus = orderEventBus;

    const restaurantNotificationTopic = new Topic(
      this,
      "RestaurantNotificationTopic"
    );

    const notifyRestaurantFunction = new Function(
      this,
      "NotifyRestaurantFunction",
      {
        runtime: Runtime.NODEJS_18_X,
        handler: "notify-restaurant.handler",
        code: Code.fromAsset("functions"),
        environment: {
          bus_name: orderEventBus.eventBusName,
          restaurant_notification_topic: restaurantNotificationTopic.topicArn,
        },
      }
    );
    orderEventBus.grantPutEventsTo(notifyRestaurantFunction);
    restaurantNotificationTopic.grantPublish(notifyRestaurantFunction);

    const rule = new Rule(this, "Rule", {
      eventBus: orderEventBus,
      eventPattern: {
        source: ["big-mouth"],
        detailType: ["order_placed"],
      },
    });
    rule.addTarget(new LambdaFunction(notifyRestaurantFunction));

    const isE2eTest = props.stageName.startsWith("dev");
    const condition = new CfnCondition(this, "IsE2eTest", {
      expression: Fn.conditionEquals("true", isE2eTest),
    });

    const testQueue = new Queue(this, "E2eTestQueue", {
      retentionPeriod: Duration.seconds(60),
      visibilityTimeout: Duration.seconds(1),
    });
    testQueue.node.defaultChild.cfnOptions.condition = condition;
    if (isE2eTest) {
      testQueue.addToResourcePolicy(
        new PolicyStatement({
          actions: ["sqs:SendMessage"],
          resources: [testQueue.queueArn],
          principals: [new ServicePrincipal("sns.amazonaws.com")],
          conditions: {
            ArnEquals: {
              "aws:SourceArn": restaurantNotificationTopic.topicArn,
            },
          },
        })
      );
      const subscription = new Subscription(this, "E2eTestSnsSubscription", {
        topic: restaurantNotificationTopic,
        protocol: "sqs",
        endpoint: testQueue.queueArn,
        rawMessageDelivery: false,
      });
      subscription.node.defaultChild.cfnOptions.condition = condition;

      new CfnOutput(this, "E2eTestQueueUrl", {
        value: testQueue.queueUrl,
      });
    }
  }
}

module.exports = { EventsStack };
