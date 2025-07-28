#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CSJDigProdTesseractOCRStack } from '../lib/csj-dig-prod-app-tesseract-ocr/csj-dig-prod-tesseract-ocr-stack';

const app = new cdk.App();

new CSJDigProdTesseractOCRStack(app, 'CSJDigProdTesseractOCRStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});

// new CSJDigSampleStack(app, 'SampleStack', {
//   env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
// });