FROM debian:buster-slim

ENV LANG=C.UTF-8 LC_ALL=C.UTF-8
ENV PATH /opt/conda/bin:$PATH
ENV PATH /opt/conda/envs/inference/bin:$PATH

######################### BASIC SECTION ################################

#RUN apt-get update --fix-missing && \
    #apt-get install -y wget bzip2 ca-certificates libglib2.0-0 libxext6 libsm6 libxrender1 git mercurial subversion unzip && \
    #apt-get install -y libgl1-mesa-glx

RUN apt-get clean

#RUN apt-get install -y libcurl4-openssl-dev

# Install build dependencies
RUN apt-get update && \
apt-get install -y \
wget \
unzip \
libcurl4-openssl-dev

######################### CLI & BOTO3 SECTION ################################
# install AWS CLI
RUN apt-get install -y curl && curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" \
  && unzip awscliv2.zip \
  && ./aws/install \
  && rm -f awscliv2.zip

RUN apt-get install -y python3-boto3
RUN apt-get install -y python3-pip

######################### MXNet SECTION ################################

# Install some dependencies and common utils
RUN apt-get update && apt-get install -y build-essential git libatlas-base-dev libopencv-dev

# Install MXNet
RUN pip3 install mxnet
#RUN apt-get install -y python3-pip

######################### CONDA SECTION ################################

RUN wget --quiet https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O ~/miniconda.sh && \
    /bin/bash ~/miniconda.sh -b -p /opt/conda && \
    rm ~/miniconda.sh && \
    # /opt/conda/bin/conda clean -tipsy && \
    /opt/conda/bin/conda clean -tip && \
    ln -s /opt/conda/etc/profile.d/conda.sh /etc/profile.d/conda.sh && \
    echo ". /opt/conda/etc/profile.d/conda.sh" >> ~/.bashrc && \
    echo "conda activate base" >> ~/.bashrc && \
    find /opt/conda/ -follow -type f -name '*.a' -delete && \
    find /opt/conda/ -follow -type f -name '*.js.map' -delete && \
    # /opt/conda/bin/conda clean -afys
    /opt/conda/bin/conda clean -af
RUN conda install python=3.7
RUN conda update -n base -c defaults conda
RUN conda install -c anaconda boto3 numpy mxnet
#COPY environment.yml /

#RUN conda env create -f environment.yml

RUN conda clean -tp -y

RUN echo "source activate inference" > ~/.bashrc

######################### ENTRY POINT SECTION ################################

COPY inference.py /

CMD ["python", "inference.py"]
