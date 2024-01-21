const middy = require("@middy/core");
const ssm = require("@middy/ssm");

const { DynamoDB } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");
const dynamodbClient = new DynamoDB();
const dynamodb = DynamoDBDocumentClient.from(dynamodbClient);

const { service_name, stage_name } = process.env;

const tableName = process.env.restaurants_table;

const getRestaurants = async (count) => {
  console.log(`fetching ${count} restaurants from ${tableName}...`);

  //   scanCommand is inefficient for large tables
  const resp = await dynamodb.send(
    new ScanCommand({
      TableName: tableName,
      Limit: count,
    })
  );
  console.log(`found ${resp.Items.length} restaurants`);
  return resp.Items;
};

module.exports.handler = middy(async (event, context) => {
  const restaurants = await getRestaurants(context.config.defaultResults);
  const response = {
    statusCode: 200,
    body: JSON.stringify(restaurants),
  };

  return response;
}).use(
  ssm({
    cache: true,
    cacheExpiry: 1 * 60 * 1000, // 1 mins
    setToContext: true,
    fetchData: {
      config: `/${service_name}/${stage_name}/get-restaurants/config`,
    },
  })
);
