const FractionalNFT = artifacts.require("FractionalNFT");

module.exports = function (deployer) {
  deployer.deploy(FractionalNFT, "FractionNFT", "FNFT");
};
