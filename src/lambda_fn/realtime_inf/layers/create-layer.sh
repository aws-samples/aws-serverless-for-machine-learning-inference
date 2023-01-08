#!/bin/bash

if [ "$1" != "" ] || [$# -gt 1]; then
	echo "Creating MxNet layer compatible with python version $1"
    rm -f mxnet.zip
	docker run -v "$PWD":/var/task "lambci/lambda:build-python$1" /bin/sh -c "/var/lang/bin/python$1 -m pip install --upgrade pip; pip install -r requirements.txt -t python/lib/python$1/site-packages/; exit"
	zip -r mxnet.zip python > /dev/null
	sudo rm -rf python
	echo "Done creating layer!"
	ls -lah mxnet.zip

else
	echo "Enter python version as argument - ./createlayer.sh 3.7"
fi