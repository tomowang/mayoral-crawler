'use strict';

const fs = require('fs');
const path = require('path');
const url = require('url');
const request = require('request');
const async = require('async');
const _ = require('lodash');
const cheerio = require('cheerio');

const baseUrl = 'https://www.childrensalon.com/designer/mayoral';
const CONCURRENCY = 10;
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36';

// Gets a page and returns a callback with a $ object
function getPage(url, fn) {
  request({
    headers: {
      'User-Agent': USER_AGENT,
      'Referer': baseUrl
    },
    url: url,
    family: 4,
    timeout: 60 * 1000
  }, function (error, response, body) {
    fn(cheerio.load(body))
  });
}

let pages = _.map(new Array(1), (x, i) => {return baseUrl + '?p=' + (i + 1)});

async.eachLimit(pages, CONCURRENCY, (page) => {
  console.log('crawl list page: ' + page);
  getPage(page, ($) => {
    $('.products-grid .product-item > a').each((i, e) => {
      const url = $(e).attr('href');
      const start = url.lastIndexOf('-'), end = url.lastIndexOf('.html');
      const id = url.substring(start + 1, end);
      const dir = `images/${id}`;
      if (fs.existsSync(dir)){
        console.log('already crawled: ' + url);
        return; // skip
      } else {
        fs.mkdirSync(dir);
      }
      let item = {
        id: id,
        url: url,
        images: []
      };
      console.log('crawl detail page: ' + item.url);
      getPage(item.url, ($) => {
        $('ul.slides > li > a').each((i, e) => {
          const url = $(e).attr('hrefx2');
          const start = url.lastIndexOf('-'), end = url.lastIndexOf('.');
          const id = url.substring(start + 1, end);
          const fmt = url.substring(end);
          item.images.push({
            id: id,
            url: url,
            fmt: fmt
          });
        });
        let images = _.map(item.images, (image) => {
          image.itemId = item.id;
          return image;
        });
        async.eachLimit(images, CONCURRENCY, fetchImg, (err) => {
          err ? console.log(err) : console.log('success fetch images for ' + item.url);
        });
      });
    });
  });
}, (err) => {
  err ? console.log(err) : console.log('done');
});

function fetchImg (image, done) {
  let filename = image.id + image.fmt;
  let filePath = `images/${image.itemId}/${filename}`;
  try {
    fs.accessSync(filePath, fs.F_OK);
    console.log('image already exists: ' + filePath);
    done(null);
  } catch (e) {
    console.log('fetch image: ' + image.url);
    let stream = request({
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': baseUrl
      },
      url: image.url,
      family: 4,
      timeout: 60 * 1000
    })
      .on('error', function(err) {
        console.log(err);
        done(err);
      })
      .pipe(fs.createWriteStream(filePath));
    stream.on('finish', function () {
      console.log('finish fetch image: ' + image.url);
      done(null);
    });
  }
}
