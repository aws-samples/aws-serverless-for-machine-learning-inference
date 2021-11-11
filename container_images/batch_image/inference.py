import boto3
import urllib3
import os, io, sys, time, argparse, json, random
import numpy as np
from botocore.exceptions import ClientError
#from operator import itemgetter, attrgetter
from datetime import datetime
from time import sleep
from mxnet import gluon
import mxnet as mx

# Logging Category Types
LOGTYPE_ERROR = 'ERROR'
LOGTYPE_INFO = 'INFO'
LOGTYPE_DEBUG = 'DEBUG'

# S3 Bucket Prefix for uploaded files
INPUT_PREFIX = 'input/'

# https://mxnet.apache.org/versions/1.7/api/python/docs/tutorials/deploy/inference/image_classification_jetson.html
def resnet_pipeline(filePath, fileName):

    # set context
    ctx = mx.cpu()

    # load pre-trained model
    net = gluon.model_zoo.vision.resnet50_v1(pretrained=True, ctx=ctx)
    net.hybridize(static_alloc=True, static_shape=True)

    # load labels
    lblPath = gluon.utils.download('http://data.mxnet.io/models/imagenet/synset.txt')
    with open(lblPath, 'r') as f:
        labels = [l.rstrip() for l in f]

    # download and format image as (batch, RGB, width, height)
    img = mx.image.imread(filePath)
    img = mx.image.imresize(img, 224, 224) # resize
    img = mx.image.color_normalize(img.astype(dtype='float32')/255,
                                   mean=mx.nd.array([0.485, 0.456, 0.406]),
                                   std=mx.nd.array([0.229, 0.224, 0.225])) # normalize
    img = img.transpose((2, 0, 1)) # channel first
    img = img.expand_dims(axis=0) # batchify
    img = img.as_in_context(ctx)

    prob = net(img).softmax() # predict and normalize output
    idx = prob.topk(k=5)[0] # get top 5 result
    inferenceCsv = "InputFile,Probability,Label"
    for i in idx:
        i = int(i.asscalar())
        #print('With prob = %.5f, it contains %s' % (prob[0,i].asscalar(), labels[i]))
        inferenceCsv  = inferenceCsv + "\n" + fileName + ",{:.2f}".format(prob[0,i].asscalar()) + ','+ labels[i]

    return inferenceCsv

def get_inference(inputBucket, fileName, region):
    s3 = boto3.client('s3')
    inputFilePath = '/tmp/'+fileName
    inferenceFilePath = '/tmp/'+fileName.split('.')[0]+'_out.csv'
    # Download file from S3
    try:
        s3.download_file(inputBucket, INPUT_PREFIX+fileName, inputFilePath)

    except ClientError as e:
        logMessage(fileName, "Error retrieving file from S3 using `download_fileobj`" + str(e), LOGTYPE_DEBUG)

    # Process file
    try:
        inference = resnet_pipeline(inputFilePath, fileName)
        print("inference from resnet_pipeline as below:")
        print(inference)
        with open(inferenceFilePath, "w") as ff:
            ff.write(inference)

    except Exception as e:
        logMessage(fileName, "Error processing file " + str(e), LOGTYPE_DEBUG)

    # Upload processed file to S3
    try:
        endTime = datetime.now()
        with open(inferenceFilePath, 'rb') as file:
            s3.upload_fileobj(
                file,
                inputBucket,
                'output/'+endTime.strftime("%m-%d-%Y-%H:%M:%S.%f")[:-3]+'-'+fileName.split('.')[0]+'.csv'
                )

    except ClientError as e:
        logMessage(fileName, "Can't upload to S3 using `upload_fileobj`" + str(e), LOGTYPE_DEBUG)

def logMessage(file, message, logType):

    try:
        logMessageDetails = constructMessageFormat(file, message, '', logType)

        if logType == "INFO" or logType == "ERROR":
            print(logMessageDetails)

        elif logType == "DEBUG":

            try:
                if os.environ.get('DEBUG') == "LOGTYPE":
                   print(logMessageDetails)

            except KeyError:
                pass

    except Exception as e:
        logMessageDetails = constructMessageFormat(file, message, "Error occurred at inference.logMessage" + str(e), logType)
        print(logMessageDetails)


def constructMessageFormat(file, message, additionalErrorDetails, logType):

    if additionalErrorDetails != '':
        return "File: "+file+" "+logType+": "+ message+" Additional Details -  "+additionalErrorDetails

    else:
        return "File: "+file+" "+logType+": "+message


def main():
    # Capture environment variables
    inputBucket = str(os.environ.get('INPUT_BUCKET'))
    fileName = str(os.environ.get('FILE_NAME').split('/')[-1])
    region = str(os.environ.get('REGION'))

    # Start Image Processing using Environment Variables
    logMessage(fileName, "Starting Processing", LOGTYPE_INFO)
    get_inference(inputBucket, fileName, region)


if __name__ == '__main__':
    main()
