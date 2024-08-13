import {
  useConnection,
  useAnchorWallet,
} from "@solana/wallet-adapter-react"
import * as anchor from "@project-serum/anchor"
import { FC, useCallback, useEffect, useState } from "react"
import idl from "../idl.json"
import voucherIdl from '../voucher_idl.json';
import { Button, HStack, VStack, Text } from "@chakra-ui/react"
import { ComputeBudgetProgram, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddress } from '@solana/spl-token'

const PROGRAM_ID = `9sMy4hnC9MML6mioESFZmzpntt3focqwUq1ymPgbMf64`
const VOUCHER_PROGRAM_ID = `FhCJ9GkJ9zmNjFEc6tE1GpfRB8hTXTnT3HFw6WGULUwF`
const TOKEN_METADATA_PROGRAM_ID = `metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s`

export interface Props {
  counter
  setTransactionUrl
}

export const Increment: FC<Props> = ({ counter, setTransactionUrl }) => {
  const [count, setCount] = useState(0)
  const [eligibleCount, setEligibleCount] = useState(0)
  const [program, setProgram] = useState<anchor.Program>()
  const [voucherProgram, setVoucherProgram] = useState<anchor.Program>()
  const { connection } = useConnection()
  const wallet = useAnchorWallet()

  useEffect(() => {
    let provider: anchor.Provider

    try {
      provider = anchor.getProvider()
    } catch {
      provider = new anchor.AnchorProvider(connection, wallet, {})
      anchor.setProvider(provider)
    }

    const program = new anchor.Program(idl as anchor.Idl, PROGRAM_ID)
    const voucherProgram = new anchor.Program(voucherIdl as anchor.Idl, VOUCHER_PROGRAM_ID)
    setProgram(program)
    setVoucherProgram(voucherProgram)
    refreshCount(program)
  }, [])

  const incrementCount = useCallback(async () => {
    const sig = await program.methods
      .increment()
      .accounts({
        counter: counter,
      })
      .rpc()

    setTransactionUrl(`https://explorer.solana.com/tx/${sig}?cluster=devnet`)
  }, [program])

  const decrementCount = useCallback(async () => {
    const sig = await program.methods
      .decrement()
      .accounts({
        counter: counter,
      })
      .rpc()

    setTransactionUrl(`https://explorer.solana.com/tx/${sig}?cluster=devnet`)
  }, [program])

  const refreshCount = async (program) => {
    const counterAccount = await program.account.counter.fetch(counter)
    setCount(counterAccount.count.toNumber())
  }


  const refreshEligibleUsers = async (voucherProgram) => {
    const eligibleUsers = await voucherProgram.account.eligibleUsers.all()
    console.log(eligibleUsers);
    setEligibleCount(eligibleUsers.length)
  }

  const userClaimNft = useCallback(async () => {
    const mint = Keypair.generate()
    const campaignId = new anchor.BN(0)
    const seed = 'seed1'
    const [config] = PublicKey.findProgramAddressSync(
      [Buffer.from('CONFIG')],
      new PublicKey(VOUCHER_PROGRAM_ID),
    )
    const [authority] = PublicKey.findProgramAddressSync(
      [Buffer.from('AUTHORITY')],
      new PublicKey(VOUCHER_PROGRAM_ID),
    )
    const [vault] = PublicKey.findProgramAddressSync(
      [Buffer.from('VAULT'), Buffer.from(seed)],
      new PublicKey(VOUCHER_PROGRAM_ID),
    )
    const [campaign] = PublicKey.findProgramAddressSync(
      [Buffer.from('CAMPAIGN'), campaignId.toArrayLike(Buffer, 'le', 8)],
      new PublicKey(VOUCHER_PROGRAM_ID),
    )

    const [eligibleUsers] = PublicKey.findProgramAddressSync(
      [Buffer.from('ELIGIBLE_USERS'), wallet.publicKey.toBuffer(), campaignId.toArrayLike(Buffer, 'le', 8)],
      new PublicKey(VOUCHER_PROGRAM_ID),
    )

    const [repayDebtVoucher] = PublicKey.findProgramAddressSync(
      [Buffer.from('REPAY_DEBT_VOUCHER'), mint.publicKey.toBuffer()],
      new PublicKey(VOUCHER_PROGRAM_ID),
    )

    const [mintMetadata] = PublicKey.findProgramAddressSync(
      [Buffer.from('metadata'), new PublicKey(TOKEN_METADATA_PROGRAM_ID).toBuffer(), mint.publicKey.toBuffer()],
      new PublicKey(TOKEN_METADATA_PROGRAM_ID),
    )

    const [mintMasterEdition] = PublicKey.findProgramAddressSync(
      [Buffer.from('metadata'), new PublicKey(TOKEN_METADATA_PROGRAM_ID).toBuffer(), mint.publicKey.toBuffer(), Buffer.from('edition')],
      new PublicKey(TOKEN_METADATA_PROGRAM_ID),
    )

    const campaignData = await voucherProgram.account.campaign.fetch(campaign)
    console.log(`CAMPAIGN DATA`, campaignData)
    const operator = campaignData.operator as PublicKey
    console.log(`CAMPAIGN OPERATOR`, operator.toBase58())
    const userTokenAccount = await getAssociatedTokenAddress(mint.publicKey, wallet.publicKey)

    const configData = await voucherProgram.account.config.fetch(config)
    console.log(`CONFIG DATA`, configData)
    const collectionMint = configData.collection as PublicKey
    console.log(`COLLECTION `, collectionMint.toBase58())
    const [collectionMetadataAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from('metadata'), new PublicKey(TOKEN_METADATA_PROGRAM_ID).toBuffer(), collectionMint.toBuffer()],
      new PublicKey(TOKEN_METADATA_PROGRAM_ID),
    )

    const [collectionMasterEdition] = PublicKey.findProgramAddressSync(
      [Buffer.from('metadata'), new PublicKey(TOKEN_METADATA_PROGRAM_ID).toBuffer(), collectionMint.toBuffer(), Buffer.from('edition')],
      new PublicKey(TOKEN_METADATA_PROGRAM_ID),
    )

    console.log('ADDRESS ', wallet.publicKey.toBase58())
    const eligibleUserData = await voucherProgram.account.eligibleUsers.fetch(eligibleUsers)
    console.log("ELIGIBLE DATA", eligibleUserData)

    try {
      const modifyComputeUnit = ComputeBudgetProgram.setComputeUnitLimit({
        units: 1000000
      })
    const claimNftIns = await voucherProgram.methods.userClaimNft()
      .accounts({
        config,
        vault,
        user: wallet.publicKey,
        authority,
        campaign,
        operator,
        mint: mint.publicKey,
        userTokenAccount,
        metadataAccount: mintMetadata,
        masterEdition: mintMasterEdition,
        collectionMint,
        collectionMetadataAccount,
        collectionMasterEdition,
        repayDebtVoucher,
        eligibleUsers,
        tokenMetadataProgram: new PublicKey(TOKEN_METADATA_PROGRAM_ID),
      })
      .instruction()
      const transaction = new Transaction().add(modifyComputeUnit, claimNftIns)
      const provider = anchor.getProvider()
      const sig = provider.sendAndConfirm(transaction, [mint])
      console.log(`Perform claim nft success at tx`, sig)
    } catch (error) {
      console.error(error)
      throw error
    }
  }, [voucherProgram])



  return (
    <VStack>
      <HStack>
        <Button onClick={incrementCount}>Increment</Button>
        <Button onClick={decrementCount}>Decrement</Button>
        <Button onClick={() => refreshCount(program)}>Refresh count</Button>
        <Button onClick={() => refreshEligibleUsers(voucherProgram)}>Refresh eligible users</Button>
        <Button onClick={userClaimNft}>Claim NFT</Button>
      </HStack>
      <Text color="white">Count: {count}</Text>
      <Text color="white">Eligbile Counts: {eligibleCount}</Text>
    </VStack>
  )
}
