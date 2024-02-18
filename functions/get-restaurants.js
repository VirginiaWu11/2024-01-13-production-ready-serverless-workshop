const middy = require("@middy/core");
const ssm = require("@middy/ssm");
const middyCacheEnabled = JSON.parse(process.env.middy_cache_enabled);
const middyCacheExpiry = parseInt(process.env.middy_cache_expiry_milliseconds);
const {
  Logger,
  injectLambdaContext,
} = require("@aws-lambda-powertools/logger");
const logger = new Logger({ serviceName: process.env.service_name });

const { DynamoDB } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");
const dynamodbClient = new DynamoDB();
const dynamodb = DynamoDBDocumentClient.from(dynamodbClient);
const {
  Tracer,
  captureLambdaHandler,
} = require("@aws-lambda-powertools/tracer");
const tracer = new Tracer({ serviceName: process.env.service_name });
tracer.captureAWSv3Client(dynamodb);

const { service_name, ssm_stage_name } = process.env;

const tableName = process.env.restaurants_table;

const getRestaurants = async (count) => {
  logger.refreshSampleRateCalculation();
  logger.debug("getting restaurants from DynamoDB...", {
    count,
    tableName,
  });

  //   scanCommand is inefficient for large tables
  const resp = await dynamodb.send(
    new ScanCommand({
      TableName: tableName,
      Limit: count,
    })
  );
  logger.debug("found restaurants", {
    count: resp.Items.length,
  });
  return resp.Items;
};

module.exports.handler = middy(async (event, context) => {
  const restaurants = await getRestaurants(context.config.defaultResults);
  const response = {
    statusCode: 200,
    body: JSON.stringify(restaurants),
  };

  return response;
})
  .use(
    ssm({
      cache: middyCacheEnabled,
      cacheExpiry: middyCacheExpiry,
      setToContext: true,
      fetchData: {
        config: `/${service_name}/${ssm_stage_name}/get-restaurants/config`,
      },
    })
  )
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));
