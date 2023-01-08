import json
from mxnet import gluon
import mxnet as mx
import base64

def lambda_handler(event, context):
    file_content = base64.b64decode(event['content'])
    inputFilePath = '/tmp/input.jpg'
    with open(inputFilePath, 'wb')  as f:
        f.write(file_content)  # write to tmp directory

    net = gluon.model_zoo.vision.resnet50_v1(pretrained=True, root = '/tmp/')
    net.hybridize(static_alloc=True, static_shape=True)
    lblPath = gluon.utils.download('http://data.mxnet.io/models/imagenet/synset.txt',path='/tmp/')
    with open(lblPath, 'r') as f:
        labels = [l.rstrip() for l in f]

    # format image as (batch, RGB, width, height)
    img = mx.image.imread(inputFilePath)
    img = mx.image.imresize(img, 224, 224) # resize
    img = mx.image.color_normalize(img.astype(dtype='float32')/255,
                                   mean=mx.nd.array([0.485, 0.456, 0.406]),
                                   std=mx.nd.array([0.229, 0.224, 0.225])) # normalize
    img = img.transpose((2, 0, 1)) # channel first
    img = img.expand_dims(axis=0) # batchify

    prob = net(img).softmax() # predict and normalize output
    idx = prob.topk(k=5)[0] # get top 5 result
    inference = ''
    for i in idx:
        i = int(i.asscalar())
        print('With prob = %.5f, it contains %s' % (prob[0,i].asscalar(), labels[i]))
        inference = inference + 'With prob = %.5f, it contains %s' % (prob[0,i].asscalar(), labels[i]) + '. '
    return inference
