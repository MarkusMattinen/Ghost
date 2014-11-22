'use strict';

// # S3 storage module for Ghost blog http://ghost.org/
var fs = require('fs');
var path = require('path');
var nodefn = require('when/node/function');
var when = require('when');
var readFile = nodefn.lift(fs.readFile);
var unlink = nodefn.lift(fs.unlink);
var AWS = require('aws-sdk');
var errors = require('../errors');
var config = require('../config').aws;
AWS.config.update(config);


var util      = require('util'),
    utils     = require('../utils'),
    baseStore = require('./base');

function S3() {
}
util.inherits(S3, baseStore);

// ### Save
// Saves the image to S3
// - image is the express image object
// - returns a promise which ultimately returns the full url to the uploaded image
S3.prototype.save = function(image) {
  if (!config) return when.reject('ghost-s3 is not configured');

  var targetDir = getTargetDir();
  var targetFilename = getTargetName(image, targetDir);
  var awsPath = 'https://' + config.bucket + '.s3.amazonaws.com/';
  return readFile(image.path)
  .then(function(buffer) {
      var s3 = new AWS.S3({
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        bucket: config.bucket,
        region: config.region
      });
      return nodefn.call(s3.putObject.bind(s3), {
          Bucket: config.bucket,
          Key: targetFilename,
          Body: buffer,
          ContentType: image.type,
          CacheControl: 'max-age=' + (30 * 24 * 60 * 60) // 30 days
      });
  })
  .then(function() {
      return when.resolve(awsPath + targetFilename);
  })
  .catch(function(err) {
      errors.logError(err);
      throw err;
  });
};


// middleware for serving the files
S3.prototype.serve = function() {
  // a no-op, these are absolute URLs
  return function (req, res, next) {
    next();
  };
};


var MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];
var getTargetDir = function() {
  var now = new Date();
  return path.join(now.getFullYear() + '', MONTHS[now.getMonth()]) + '/';
};


var getTargetName = function(image, targetDir) {
  var ext = path.extname(image.name),
      name = path.basename(image.name, ext).replace(/\W/g, '_');

  return targetDir + name + '-' + Date.now() + ext;
};


// default error handler
var errors = {
  logError: function(error) {
      console.log('error in ghost-s3', error);
  }
};

module.exports = S3;
