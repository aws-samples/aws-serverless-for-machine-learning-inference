import logging
import boto3
from botocore.exceptions import ClientError
import os
import json

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):

    # Start Fargate Batch Processing - TO DO: This is to be placed under conditional statement if the payload is greater than the threshold for real-time processing.

    inputFileName = ""
    bucketName = ""

    job_name = os.environ["JOB_NAME"]
    job_queue = os.environ["JOB_QUEUE"]
    job_definition = os.environ["JOB_DEFINITION"]

    for record in event['Records']:
      bucketName = record['s3']['bucket']['name']
      inputFileName = record['s3']['object']['key']

    response = {
        'statusCode': 200,
        'body': json.dumps('Input Received - ' + json.dumps(event))
    }

    batch = boto3.client('batch')
    region = batch.meta.region_name

    batchCommand = "--bucketName " + bucketName  + " --fileName " + inputFileName + " --region " + region

    out = "Input FileName:  "+bucketName+"/"+inputFileName+" Region: " + region
    logger.info(out)

    response = batch.submit_job(jobName= job_name,
                                jobQueue= job_queue,
                                jobDefinition= job_definition,
                                containerOverrides={
                                    "command": [ "python", "inference.py", batchCommand  ],
                                    "environment": [
                                        {"name": "INPUT_BUCKET", "value": bucketName},
                                        {"name": "FILE_NAME", "value": inputFileName},
                                        {"name": "REGION", "value": region}
                                    ]
                                })

    logger.info("AWS Batch Job ID is {}.".format(response['jobId']))
    #return response

    # End Fargate Batch Processing