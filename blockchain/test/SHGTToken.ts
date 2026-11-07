
import { expect } from "chai";
import { network } from "hardhat";
const { ethers } = await network.create();

describe("SHGTToken", function () {
    async function deployTokenFixture() {

        const [admin, minter, member1, member2, unauthorized] =
            await ethers.getSigners();

        const token = await ethers.deployContract("SHGTToken", [
            admin.address,
            minter.address,
        ]);

        await token.waitForDeployment();

        return {
            token,
            admin,
            minter,
            member1,
            member2,
            unauthorized,
            ethers,
        };
    }

    it("Should have the correct name, symbol and decimals", async function () {
        const { token } = await deployTokenFixture();

        expect(await token.name()).to.equal("SHGT Token");
        expect(await token.symbol()).to.equal("SHGT");
        expect(await token.decimals()).to.equal(18);
    });

    it("Should enforce the 50 million SHGT supply cap", async function () {
        const { token, minter } = await deployTokenFixture();

        const maxSupply = await token.MAX_SUPPLY();

        await token.connect(minter).mint(
            minter.address,
            maxSupply
        );

        expect(await token.totalSupply()).to.equal(maxSupply);

        await expect(
            token.connect(minter).mint(minter.address, 1n)
        ).to.be.revert(ethers);
    });

    it("Should allow only the authorized minter to mint", async function () {
        const { token, minter, member1, unauthorized } =
            await deployTokenFixture();

        const amount = 1000n * 10n ** 18n;

        await token.connect(minter).mint(member1.address, amount);

        expect(await token.balanceOf(member1.address)).to.equal(amount);

        await expect(
            token.connect(unauthorized).mint(member1.address, amount)
        ).to.be.revert(ethers);
    });

    it("Should allow members to transfer tokens", async function () {
        const { token, minter, member1, member2 } =
            await deployTokenFixture();

        const amount = 100n * 10n ** 18n;

        await token.connect(minter).mint(member1.address, amount);
        await token.connect(member1).transfer(member2.address, amount);

        expect(await token.balanceOf(member1.address)).to.equal(0n);
        expect(await token.balanceOf(member2.address)).to.equal(amount);
    });

    it("Should allow the admin to pause and unpause transfers", async function () {
        const { token, admin, minter, member1, member2 } =
            await deployTokenFixture();

        await token.connect(minter).mint(member1.address, 100n);

        await token.connect(admin).pause();

        expect(await token.paused()).to.equal(true);

        await expect(
            token.connect(member1).transfer(member2.address, 10n)
        ).to.be.revert(ethers);

        await token.connect(admin).unpause();

        expect(await token.paused()).to.equal(false);

        await token.connect(member1).transfer(member2.address, 10n);

        expect(await token.balanceOf(member2.address)).to.equal(10n);
    });

    it("Should prevent unauthorized users from pausing the contract", async function () {
        const { token, unauthorized } = await deployTokenFixture();

        await expect(
            token.connect(unauthorized).pause()
        ).to.be.revert(ethers);
    });

    it("Should prevent the minter from granting itself admin privileges", async function () {
        const { token, minter, ethers } = await deployTokenFixture();

        const adminRole = await token.DEFAULT_ADMIN_ROLE();

        await expect(
            token.connect(minter).grantRole(adminRole, minter.address)
        ).to.be.revert(ethers);
    });

    it("Should reject deployment with zero addresses", async function () {

        await expect(
            ethers.deployContract("SHGTToken", [
                ethers.ZeroAddress,
                ethers.ZeroAddress,
            ])
        ).to.be.revert(ethers);
    });

    it("Should reject deployment when admin and minter are the same", async function () {
        const [admin] = await ethers.getSigners();

        await expect(
            ethers.deployContract("SHGTToken", [
                admin.address,
                admin.address,
            ])
        ).to.be.revert(ethers);
    });

    it("Should prevent minting while the contract is paused", async function () {
        const { token, admin, minter, member1 } =
            await deployTokenFixture();

        await token.connect(admin).pause();

        await expect(
            token.connect(minter).mint(member1.address, 100n)
        ).to.be.revert(ethers);
    });

    it("Should prevent unauthorized users from unpausing", async function () {
        const { token, admin, unauthorized } =
            await deployTokenFixture();

        await token.connect(admin).pause();

        await expect(
            token.connect(unauthorized).unpause()
        ).to.be.revert(ethers);
    });

});
