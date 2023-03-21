import { RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CloudFrontToS3} from '@aws-solutions-constructs/aws-cloudfront-s3'
import { LambdaToDynamoDB } from '@aws-solutions-constructs/aws-lambda-dynamodb'
import { AttributeType } from 'aws-cdk-lib/aws-dynamodb';
import { Code, Runtime } from 'aws-cdk-lib/aws-lambda';
import { CognitoToApiGatewayToLambda } from '@aws-solutions-constructs/aws-cognito-apigateway-lambda';
import { AccountRecovery } from 'aws-cdk-lib/aws-cognito';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class CdkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const s3Cloudfront = new CloudFrontToS3(this, 'S3-CloudFront', {
      insertHttpSecurityHeaders: false,
      bucketProps: {
        bucketName: 'frontend-resources-todolist',
        removalPolicy: RemovalPolicy.DESTROY,
      },
      cloudFrontLoggingBucketProps: {
        removalPolicy: RemovalPolicy.DESTROY,
      },
      loggingBucketProps: {
        removalPolicy: RemovalPolicy.DESTROY,
      }
    })
    
    const lambdaDynamoDB = new LambdaToDynamoDB(this, 'Lambda-DynamoDB', {
      dynamoTableProps: {
        tableName: 'db-todolist',
        partitionKey: { name: 'user_id', type: AttributeType.STRING },
        sortKey: { name: 'task_id', type: AttributeType.STRING },
        removalPolicy: RemovalPolicy.DESTROY,
      },
      lambdaFunctionProps: {
        functionName: 'to-do-list-lambda',
        runtime: Runtime.PYTHON_3_9,
        code: Code.fromInline('def handler(): print("Hello World")'),
        handler: 'index.handler',
      }
    })

    const cognitoApigatewayLambda = new CognitoToApiGatewayToLambda(this, 'Cognito-Apigateway-Lambda', {
      cognitoUserPoolProps: {
        accountRecovery: AccountRecovery.EMAIL_ONLY,
        selfSignUpEnabled: true,
        signInAliases: {username: false, email: true},
        autoVerify: {email: true, phone: false},
        removalPolicy: RemovalPolicy.DESTROY,
      },
      cognitoUserPoolClientProps: {
        oAuth: {
          flows: {
            implicitCodeGrant: true,
          },
          callbackUrls: [
            `https://${s3Cloudfront.cloudFrontWebDistribution.distributionDomainName}`,
          ],
        },
      },
      apiGatewayProps: {
        defaultCorsPreflightOptions: {
          allowOrigins: ['*'],
          allowHeaders: ['Content-Type','X-Amz-Date','Authorization','X-Api-Key','X-Amz-Security-Token'],
          allowMethods: ['POST','OPTIONS','GET','PUT','DELETE'],
        },
      },
      existingLambdaObj: lambdaDynamoDB.lambdaFunction
    })
    cognitoApigatewayLambda.userPool.addDomain('todovk', {
      cognitoDomain: {
        domainPrefix: 'todovk'
      }
    })



    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'CdkQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
  }
}