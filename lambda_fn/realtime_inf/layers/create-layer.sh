#!/bin/bash

if [ "$1" != "" ] || [$# -gt 1]; then
	echo "Creating layer compatible with python version $1"
    rm -f layer.zip
	docker run -v "$PWD":/var/task "lambci/lambda:build-python$1" /bin/sh -c "/var/lang/bin/python3.6 -m pip install --upgrade pip; pip install -r requirements.txt -t python/lib/python$1/site-packages/; exit"
	zip -r layer.zip python > /dev/null
	rm -r python
	echo "Done creating layer!"
	ls -lah layer.zip

else
	echo "Enter python version as argument - ./createlayer.sh 3.6"
fi