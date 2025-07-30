#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CSJDigProdTesseractOCRStack } from '../lib/csj-dig-prod-app-tesseract-ocr/csj-dig-prod-tesseract-ocr-stack';
import { CSJProdDigitalizacionEstampilladoApiStack } from '../lib/csj-prod-digitalizacion-estampillado-api/csj-prod-digitalizacion-estampillado-api';

const app = new cdk.App();

new CSJDigProdTesseractOCRStack(app, 'CSJDigProdTesseractOCRStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});

new CSJProdDigitalizacionEstampilladoApiStack(app, 'CSJProdDigitalizacionEstampilladoApiStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});