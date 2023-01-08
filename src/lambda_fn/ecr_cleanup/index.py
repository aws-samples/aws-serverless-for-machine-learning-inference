from typing import Any
import boto3
from botocore.exceptions import ClientError
import logging


ecr_client = boto3.client("ecr")

def on_event(event,context):
    print(event)
    request_type = event['RequestType']
    if request_type == 'Create':
        return on_create(event)
    if request_type == 'Update':
        return on_update(event)
    if request_type == 'Delete':
        return on_delete(event)
    raise Exception("Invalid request type: %s" % request_type)

def on_create(event):
  props = event["ResourceProperties"]
  print("create new resource with props %s" % props)

  # Add create code here
#   physical_id = ...

#   return { "PhysicalResourceId": physical_id}

def on_update(event):
    physical_id = event["PhysicalResouceId"]
    props = event["ResourceProperties"]
    print("update resource %s with props %s" % (physical_id, props))

    # Add update code here

def on_delete(event):
    physical_id = event["PhysicalResourceId"]
    props = event["ResourceProperties"]
    repository = props["Repository"]
    print("resource id: %s" % physical_id)
    print("deleting images in repository: %s" % repository)
    images = ecr_client.list_images(repositoryName = repository)
    for image in images["imageIds"]:
        image_id_list = image

    try:
        if images:
            ecr_client.batch_delete_image(
                imageIds=[image_id_list], repositoryName=repository
            )
            print("successfully deleted images")
    except ClientError as e:
        logging.error(e)




