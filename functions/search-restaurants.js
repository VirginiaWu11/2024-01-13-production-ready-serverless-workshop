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

const findRestaurantsByTheme = async (theme, count) => {
  logger.refreshSampleRateCalculation();
  logger.debug("finding restaurants by theme...", { theme, count });

  const resp = await dynamodb.send(
    new ScanCommand({
      TableName: tableName,
      Limit: count,
      FilterExpression: "contains(themes, :theme)",
      ExpressionAttributeValues: { ":theme": theme },
    })
  );
  logger.debug("found restaurants", {
    count: resp.Items.length,
  });
  return resp.Items;
};

module.exports.handler = middy(async (event, context) => {
  const req = JSON.parse(event.body);
  const theme = req.theme;
  const restaurants = await findRestaurantsByTheme(
    theme,
    context.config.defaultResults
  );
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
        config: `/${service_name}/${ssm_stage_name}/search-restaurants/config`,
        secretString: `/${service_name}/${ssm_stage_name}/search-restaurants/secretString`,
      },
    })
  )
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));
