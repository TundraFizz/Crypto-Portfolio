var app     = require("../server.js");
var request = require("request");
var mysql   = require("mysql");
var fs      = require("fs");

app.post("/sample", function(req, res){
  //
  res.json(sample);
});

app.get("/", function(req, res){
  var sql1 = "SELECT * FROM coins";
  var sql2 = "SELECT grand_total FROM total WHERE id=1";

  mySql.con.query(sql1, function(err, result1){
    mySql.con.query(sql2, function(err, result2){
      res.render("index.ejs", {
        "data":       result1,
        "grandTotal": result2[0]["grand_total"].toFixed(2)
      });
    });
  });
});

app.get("/about", function(req, res){
  var people = CsvToObject("data/people.csv");
  res.render("about.ejs", {people: people});
});

app.use(function(req, res){
  res.render("404.ejs");
});

function MySql(){
  this.con = mysql.createConnection({
    "host"    : "localhost",
    "user"    : "root",
    "password": "",
    "database": "portfolio"
  });
}

MySql.prototype.Query = function(sql, args){return new Promise((resolve) => {
  var self = this;

  self.con.query(sql, args, function(err, result){
    resolve();
  });
})}

MySql.prototype.Commit = function(){return new Promise((resolve) => {
  var self = this;

  self.con.commit(function(err){
    resolve();
  });
})}

var mySql = new MySql();
var folio = new Portfolio();

function Portfolio(){
  var self = this;

  self.coins      = null;
  self.busy       = false;
  self.busy2      = false;
  self.index      = 0;
  self.interval   = null;
  self.intervalOut= null;

  self.updateQueue = [];

  mySql.con.query("SELECT * FROM total", function(err, result){
    self.grandTotal = result[0]["grand_total"];
  });
}

Portfolio.prototype.GetCoins = function(){return new Promise((resolve) => {
  var self = this;
  var sql  = "SELECT * FROM coins";
  var args = [];
  mySql.con.query(sql, args, function(err, result){
    self.coins = JSON.parse(JSON.stringify(result)); // Remove RowDataPacket
    resolve();
  });
})}

Portfolio.prototype.BeginLoop = function(){
  var self      = this;
  self.intervalOut = setInterval(() => self.ServerLoop(), 30000);
}

Portfolio.prototype.ServerLoop = function(){
  var self = this;

  if(!self.busy2){
    self.busy2 = true;
    self.interval = setInterval(() => self.ApiRequestLoop(), 1000);
  }
}

Portfolio.prototype.ApiRequestLoop = function(){
  var self = this;

  if(!self.busy){
    self.busy = true;
    self.ApiRequest();
  }
}

Portfolio.prototype.ApiRequest = function(){
  var self   = this;
  var index  = self.index;
  var coins  = self.coins;
  var coin   = coins[index]["name"].toLowerCase().replace(" ", "-");
  var id     = coins[index]["id"];
  var volume = coins[index]["volume"];
  var uri    = `https://api.coinmarketcap.com/v1/ticker/${coin}`;

  request(uri, {"json":"true"}, function(err, res, body){
    var currentPrice = body[0]["price_usd"];
    var totalValue   = parseFloat(currentPrice * volume).toFixed(2);

    self.updateQueue.push({
      "currentPrice": currentPrice,
      "totalValue"  : totalValue,
      "id"          : id
    });

    // console.log(`========== ${coin} ==========`);

    if(++self.index == coins.length){
      var jobs = coins.length;
      var sql  = "UPDATE coins SET current_price=?, total_value=? WHERE id=?";

      self.updateQueue.forEach(function(i){
        var currentPrice = i["currentPrice"];
        var totalValue   = i["totalValue"];
        var id           = i["id"];
        var args         = [currentPrice, totalValue, id];

        mySql.con.query(sql, args, function(err, result){
          if(--jobs == 0){
            // console.log("All updates happened");
            // console.log();

            self.grandTotal = 0;
            for(var i = 0; i < coins.length; i++)
              self.grandTotal += parseFloat(coins[i]["total_value"]);

            var sql  = "UPDATE total SET grand_total=? WHERE id=1";
            var args = [self.grandTotal];

            mySql.con.query(sql, args, function(err, result){
              self.busy        = false;
              self.busy2       = false;
              self.index       = 0;
              self.updateQueue = [];
              clearInterval(self.interval);
            });
          }
        });
      });
    }
    else
      self.busy = false;
  });
}

Portfolio.prototype.Yolo = function(){return new Promise((resolve) => {
  var self  = this;
  var coins = self.coins;
})}

Portfolio.prototype.Swag = function(){return new Promise((resolve) => {
  var self        = this;
  var coins       = self.coins;


  resolve();
})}

function Run(){
  folio.GetCoins()
  .then(() => folio.BeginLoop());
}

Run();
