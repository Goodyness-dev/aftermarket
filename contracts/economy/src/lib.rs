use near_sdk::{
    assert_one_yocto, env, ext_contract, near, require, AccountId, Gas,
    PanicOnDefault, Promise,
    collections::LookupMap, json_types::{U128, U64}, serde_json::{json, Value},
};

const MAX_BATCH: usize = 20;

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Token {
    pub token_id: String,
    pub owner_id: Option<AccountId>,
    pub model: String,
    pub condition: u8,
    pub unique: bool,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Listing {
    pub id: U64,
    pub seller: AccountId,
    pub token_id: String,
    pub price: U128,
    pub expires_at: U64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Loot {
    pub token_id: String,
    pub return_to: AccountId,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Raid {
    pub player: AccountId,
    pub weapon: String,
    pub expires_at: U64,
    pub settled: bool,
    pub loot: Vec<Loot>,
}

#[ext_contract(receiver)]
#[allow(dead_code)]
trait Receiver {
    fn mt_on_transfer(&mut self, sender_id: AccountId, previous_owner_ids: Vec<AccountId>, token_ids: Vec<String>, amounts: Vec<U128>, msg: String) -> Vec<U128>;
}

#[ext_contract(resolver)]
#[allow(dead_code)]
trait Resolver {
    fn mt_resolve_transfer(&mut self, sender_id: AccountId, receiver_id: AccountId, token_ids: Vec<String>, amounts: Vec<U128>) -> Vec<U128>;
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    owner: AccountId,
    operator: AccountId,
    balances: LookupMap<String, u128>,
    tokens: LookupMap<String, Token>,
    supply: LookupMap<String, u128>,
    storage: LookupMap<AccountId, u128>,
    registered: LookupMap<AccountId, bool>,
    npc_budgets: LookupMap<AccountId, u128>,
    reservations: LookupMap<String, String>,
    listings: LookupMap<u64, Listing>,
    raids: LookupMap<String, Raid>,
    listing_nonce: u64,
}

#[near]
impl Contract {
    #[init]
    pub fn new(owner_id: AccountId, operator_id: AccountId) -> Self {
        let mut c = Self {
            owner: owner_id.clone(), operator: operator_id.clone(),
            balances: LookupMap::new(b"b"), tokens: LookupMap::new(b"t"), supply: LookupMap::new(b"s"),
            storage: LookupMap::new(b"p"), registered: LookupMap::new(b"a"), npc_budgets: LookupMap::new(b"n"),
            reservations: LookupMap::new(b"v"), listings: LookupMap::new(b"l"), raids: LookupMap::new(b"r"), listing_nonce: 0,
        };
        for id in [owner_id, operator_id, env::current_account_id()] {
            c.registered.insert(&id, &true); c.storage.insert(&id, &0);
        }
        for token in ["credit", "parts", "ammo"] {
            c.tokens.insert(&token.into(), &Token {token_id: token.into(), owner_id: None, model: token.into(), condition: 100, unique: false});
            c.supply.insert(&token.into(), &0);
        }
        c
    }

    /// Prepay the actual storage used by a named account's operations.
    /// This is a game-specific API, not a claim of full NEP-145 implementation.
    #[payable]
    pub fn fund_storage(&mut self, account_id: Option<AccountId>) -> U128 {
        let before = env::storage_usage();
        let id = account_id.unwrap_or_else(env::predecessor_account_id);
        let amount = env::attached_deposit().as_yoctonear();
        require!(amount > 0, "Attach a storage deposit");
        let credit = self.storage.get(&id).unwrap_or(0).checked_add(amount).expect("Overflow");
        self.storage.insert(&id, &credit); self.registered.insert(&id, &true);
        self.charge(&id, before);
        U128(self.storage.get(&id).unwrap_or(0))
    }

    pub fn storage_credit(&self, account_id: AccountId) -> U128 { U128(self.storage.get(&account_id).unwrap_or(0)) }

    /// Initial test economy credits and bounded, server-authorized loot origins.
    /// Issuance authority is an explicit trust dependency.
    pub fn mint(&mut self, receiver_id: AccountId, token_id: String, amount: U128, model: Option<String>, condition: Option<u8>) {
        self.operator_only(); self.check_id(&token_id); self.account(&receiver_id);
        require!(amount.0 > 0, "Zero amount");
        let before = env::storage_usage();
        if self.tokens.get(&token_id).is_none() {
            require!(amount.0 == 1 && model.as_ref().is_some_and(|m| ["pistol", "smg", "rifle"].contains(&m.as_str())), "New tokens must be supported unique guns");
            self.tokens.insert(&token_id, &Token {token_id: token_id.clone(), owner_id: Some(receiver_id.clone()), model: model.unwrap(), condition: condition.unwrap_or(100).min(100), unique: true});
        } else { require!(!self.tokens.get(&token_id).unwrap().unique, "Unique token already exists"); }
        let total = self.supply.get(&token_id).unwrap_or(0).checked_add(amount.0).expect("Supply overflow");
        self.supply.insert(&token_id, &total);
        let balance = self.balance(&receiver_id, &token_id).checked_add(amount.0).expect("Balance overflow");
        self.put(&receiver_id, &token_id, balance);
        self.emit("mt_mint", json!({"owner_id":receiver_id,"token_ids":[token_id],"amounts":[amount]}));
        self.charge(&env::predecessor_account_id(), before);
    }

    pub fn mt_token(&self, token_ids: Vec<String>) -> Vec<Option<Token>> { token_ids.iter().map(|id|self.tokens.get(id)).collect() }
    pub fn mt_balance_of(&self, account_id: AccountId, token_id: String) -> U128 { U128(self.balance(&account_id, &token_id)) }
    pub fn mt_batch_balance_of(&self, account_id: AccountId, token_ids: Vec<String>) -> Vec<U128> { token_ids.iter().map(|id|U128(self.balance(&account_id,id))).collect() }
    pub fn mt_supply(&self, token_id: String) -> Option<U128> { self.supply.get(&token_id).map(U128) }
    pub fn mt_batch_supply(&self, token_ids: Vec<String>) -> Vec<Option<U128>> { token_ids.iter().map(|id|self.supply.get(id).map(U128)).collect() }

    #[payable]
    pub fn mt_transfer(&mut self, receiver_id: AccountId, token_id: String, amount: U128, approval: Option<(AccountId,u64)>, memo: Option<String>) {
        assert_one_yocto(); require!(approval.is_none(), "Approval extension unsupported");
        let actor=env::predecessor_account_id(); let before=env::storage_usage(); self.unlocked(&token_id);
        self.transfer(&actor,&receiver_id,&token_id,amount.0,memo); self.charge(&actor,before);
    }

    #[payable]
    pub fn mt_batch_transfer(&mut self, receiver_id: AccountId, token_ids: Vec<String>, amounts: Vec<U128>, approvals: Option<Vec<Option<(AccountId,u64)>>>, memo: Option<String>) {
        assert_one_yocto(); require!(approvals.is_none(), "Approval extension unsupported"); self.batch(&token_ids,&amounts);
        let actor=env::predecessor_account_id();let before=env::storage_usage();
        for (id,amount) in token_ids.iter().zip(amounts.iter()) {self.unlocked(id);self.transfer(&actor,&receiver_id,id,amount.0,memo.clone());}
        self.charge(&actor,before);
    }

    #[payable]
    pub fn mt_transfer_call(&mut self, receiver_id: AccountId, token_id: String, amount: U128, approval: Option<(AccountId,u64)>, memo: Option<String>, msg: String) -> Promise {
        assert_one_yocto();require!(approval.is_none(),"Approval extension unsupported");self.transfer_call(receiver_id,vec![token_id],vec![amount],memo,msg)
    }

    #[payable]
    pub fn mt_batch_transfer_call(&mut self, receiver_id: AccountId, token_ids: Vec<String>, amounts: Vec<U128>, approvals: Option<Vec<Option<(AccountId,u64)>>>, memo: Option<String>, msg: String) -> Promise {
        assert_one_yocto();require!(approvals.is_none(),"Approval extension unsupported");self.transfer_call(receiver_id,token_ids,amounts,memo,msg)
    }

    #[private]
    pub fn mt_resolve_transfer(&mut self, sender_id: AccountId, receiver_id: AccountId, token_ids: Vec<String>, amounts: Vec<U128>) -> Vec<U128> {
        require!(env::predecessor_account_id()==env::current_account_id(),"Private callback");
        let unused:Vec<U128>=match env::promise_result_checked(0,4096) {
            Ok(bytes)=>near_sdk::serde_json::from_slice::<Vec<U128>>(&bytes).ok().filter(|v|v.len()==amounts.len()).unwrap_or_else(||amounts.clone()),
            _=>amounts.clone(),
        };
        token_ids.iter().zip(amounts.iter()).zip(unused.iter()).map(|((id,sent),unused)|{
            let refund=if self.reservations.get(id).is_some(){0}else{unused.0.min(sent.0).min(self.balance(&receiver_id,id))};
            // A receiver may already have spent its tokens. Refund only remaining units.
            if refund>0 {self.transfer(&receiver_id,&sender_id,id,refund,Some("unused transfer refund".into()));}
            U128(sent.0-refund)
        }).collect()
    }

    /// Only an NPC's explicitly delegated operator budget can be spent by the service.
    pub fn set_npc_budget(&mut self, npc_id: AccountId, amount: U128) {
        require!(env::predecessor_account_id()==self.owner,"Owner only");self.account(&npc_id);
        let before=env::storage_usage();self.npc_budgets.insert(&npc_id,&amount.0);self.charge(&self.owner.clone(),before);
    }
    pub fn npc_budget(&self, npc_id: AccountId) -> Option<U128> {self.npc_budgets.get(&npc_id).map(U128)}

    pub fn list_weapon(&mut self, token_id: String, price: U128, expires_at: U64) -> U64 {
        let actor=env::predecessor_account_id();self.account(&actor);self.unlocked(&token_id);
        require!(price.0>0 && price.0<=1_000_000,"Invalid price");require!(expires_at.0>env::block_height() && expires_at.0<=env::block_height()+100_000,"Invalid expiry");
        require!(self.tokens.get(&token_id).is_some_and(|t|t.unique),"Gun required");
        let before=env::storage_usage();self.transfer(&actor,&env::current_account_id(),&token_id,1,Some("listing escrow".into()));
        self.listing_nonce+=1;let id=self.listing_nonce;
        self.reservations.insert(&token_id,&format!("listing:{id}"));
        self.listings.insert(&id,&Listing{id:U64(id),seller:actor.clone(),token_id:token_id.clone(),price,expires_at});
        self.charge(&actor,before);self.game_event("listing_opened",json!({"id":id.to_string(),"seller":actor,"token_id":token_id,"price":price}));U64(id)
    }
    pub fn get_listing(&self, listing_id: U64) -> Option<Listing> {self.listings.get(&listing_id.0)}
    pub fn fill_listing(&mut self, listing_id: U64, max_price: U128) {let actor=env::predecessor_account_id();self.fill(listing_id.0,&actor,max_price.0);}
    pub fn fill_listing_for_npc(&mut self, listing_id: U64, npc_id: AccountId, max_price: U128) {
        self.operator_only();let listing=self.listings.get(&listing_id.0).expect("Listing not found");
        let budget=self.npc_budgets.get(&npc_id).expect("Not a delegated NPC");require!(budget>=listing.price.0,"NPC spending limit");
        self.fill(listing_id.0,&npc_id,max_price.0);self.npc_budgets.insert(&npc_id,&(budget-listing.price.0));
    }
    pub fn cancel_listing(&mut self, listing_id: U64) {
        let listing=self.listings.get(&listing_id.0).expect("Listing not found");let actor=env::predecessor_account_id();
        require!(actor==listing.seller || env::block_height()>listing.expires_at.0,"Seller only before expiry");
        self.reservations.remove(&listing.token_id);self.listings.remove(&listing_id.0);
        self.transfer(&env::current_account_id(),&listing.seller,&listing.token_id,1,Some("listing cancelled".into()));
        self.game_event("listing_cancelled",json!({"id":listing_id,"token_id":listing.token_id}));
    }

    pub fn begin_raid(&mut self, raid_id: String, token_id: String, expires_at: U64) {
        let actor=env::predecessor_account_id();self.check_id(&raid_id);self.account(&actor);self.unlocked(&token_id);
        require!(self.raids.get(&raid_id).is_none(),"Raid ID already used");require!(expires_at.0>env::block_height() && expires_at.0<=env::block_height()+2000,"Invalid raid expiry");
        require!(self.tokens.get(&token_id).is_some_and(|t|t.unique)&&self.balance(&actor,&token_id)==1,"Own a gun");
        let before=env::storage_usage();self.reservations.insert(&token_id,&format!("raid:{raid_id}"));
        self.raids.insert(&raid_id,&Raid{player:actor.clone(),weapon:token_id,expires_at,settled:false,loot:vec![]});self.charge(&actor,before);
        self.game_event("raid_started",json!({"raid_id":raid_id,"player":actor}));
    }
    pub fn get_raid(&self, raid_id: String) -> Option<Raid> {self.raids.get(&raid_id)}
    pub fn reservation(&self, token_id: String) -> Option<String> {self.reservations.get(&token_id)}

    /// Assign only pre-existing escrow/NPC property. No result can invent loot.
    pub fn assign_raid_loot(&mut self, raid_id: String, token_id: String, from: AccountId) {
        self.operator_only();let mut raid=self.raids.get(&raid_id).expect("Unknown raid");
        require!(!raid.settled && env::block_height()<=raid.expires_at.0,"Raid closed");require!(raid.loot.len()<12,"Loot limit");
        self.unlocked(&token_id);require!(from==env::current_account_id()||self.npc_budgets.get(&from).is_some(),"Only escrow or NPC inventory");
        require!(self.tokens.get(&token_id).is_some_and(|t|t.unique)&&self.balance(&from,&token_id)==1,"Gun unavailable");
        let before=env::storage_usage();if from!=env::current_account_id(){self.transfer(&from,&env::current_account_id(),&token_id,1,Some("raid deployment".into()));}
        self.reservations.insert(&token_id,&format!("loot:{raid_id}"));raid.loot.push(Loot{token_id,return_to:from});self.raids.insert(&raid_id,&raid);self.charge(&env::predecessor_account_id(),before);
    }
    pub fn settle_raid(&mut self, raid_id: String, success: bool, recovered: Vec<String>) {
        self.operator_only();let raid=self.raids.get(&raid_id).expect("Unknown raid");require!(env::block_height()<=raid.expires_at.0,"Raid expired");
        self.close_raid(&raid_id,success,recovered);
    }
    pub fn expire_raid(&mut self, raid_id: String) {
        let raid=self.raids.get(&raid_id).expect("Unknown raid");require!(env::block_height()>raid.expires_at.0,"Raid not expired");self.close_raid(&raid_id,false,vec![]);
    }
}

impl Contract {
    fn operator_only(&self) {require!(env::predecessor_account_id()==self.operator,"Operator only");}
    fn account(&self,id:&AccountId){require!(self.registered.get(id).unwrap_or(false),"Prepay storage first");}
    fn check_id(&self,id:&str){require!(!id.is_empty() && id.len()<=80 && !id.contains('|'),"Invalid ID");}
    fn key(account:&AccountId,token:&str)->String{format!("{account}|{token}")}
    fn balance(&self,account:&AccountId,token:&str)->u128{self.balances.get(&Self::key(account,token)).unwrap_or(0)}
    fn put(&mut self,account:&AccountId,token:&str,amount:u128){let key=Self::key(account,token);if amount==0{self.balances.remove(&key);}else{self.balances.insert(&key,&amount);}}
    fn unlocked(&self,id:&String){require!(self.reservations.get(id).is_none(),"Token is reserved");}
    fn charge(&mut self,payer:&AccountId,before:u64){
        let bytes=env::storage_usage().saturating_sub(before) as u128;let cost=bytes.checked_mul(env::storage_byte_cost().as_yoctonear()).expect("Storage overflow");
        if cost>0 {let credit=self.storage.get(payer).unwrap_or(0);require!(credit>=cost,"Insufficient prepaid storage");self.storage.insert(payer,&(credit-cost));}
    }
    fn batch(&self,ids:&Vec<String>,amounts:&Vec<U128>){require!(!ids.is_empty()&&ids.len()<=MAX_BATCH&&ids.len()==amounts.len(),"Invalid batch lengths");let mut unique=std::collections::BTreeSet::new();for id in ids{require!(unique.insert(id),"Duplicate token ID");}}
    fn transfer(&mut self,from:&AccountId,to:&AccountId,id:&String,amount:u128,memo:Option<String>){
        self.account(to);require!(from!=to && amount>0,"Invalid transfer");let balance=self.balance(from,id);require!(balance>=amount,"Insufficient token balance");
        let next=self.balance(to,id).checked_add(amount).expect("Balance overflow");self.put(from,id,balance-amount);self.put(to,id,next);
        if let Some(mut token)=self.tokens.get(id){if token.unique{token.owner_id=Some(to.clone());self.tokens.insert(id,&token);}}
        self.emit("mt_transfer",json!({"old_owner_id":from,"new_owner_id":to,"token_ids":[id],"amounts":[U128(amount)],"memo":memo}));
    }
    fn transfer_call(&mut self,receiver_id:AccountId,ids:Vec<String>,amounts:Vec<U128>,memo:Option<String>,msg:String)->Promise{
        self.batch(&ids,&amounts);require!(msg.len()<=2048,"Message too long");let actor=env::predecessor_account_id();let before=env::storage_usage();
        for (id,amount) in ids.iter().zip(amounts.iter()){self.unlocked(id);self.transfer(&actor,&receiver_id,id,amount.0,memo.clone());}
        self.charge(&actor,before);
        receiver::ext(receiver_id.clone()).with_static_gas(Gas::from_tgas(35)).mt_on_transfer(actor.clone(),vec![actor.clone();ids.len()],ids.clone(),amounts.clone(),msg)
            .then(resolver::ext(env::current_account_id()).with_static_gas(Gas::from_tgas(25)).mt_resolve_transfer(actor,receiver_id,ids,amounts))
    }
    fn fill(&mut self,id:u64,buyer:&AccountId,max:u128){
        self.account(buyer);let l=self.listings.get(&id).expect("Listing not found");require!(env::block_height()<=l.expires_at.0,"Listing expired");require!(l.price.0<=max,"Price exceeds limit");require!(*buyer!=l.seller,"Cannot self fill");
        require!(self.balance(buyer,"credit")>=l.price.0,"Insufficient credits");let before=env::storage_usage();
        self.transfer(buyer,&l.seller,&"credit".into(),l.price.0,Some("weapon payment".into()));
        self.transfer(&env::current_account_id(),buyer,&l.token_id,1,Some("listing filled".into()));
        self.reservations.remove(&l.token_id);self.listings.remove(&id);self.charge(&env::predecessor_account_id(),before);
        self.game_event("listing_filled",json!({"id":id.to_string(),"buyer":buyer,"seller":l.seller,"token_id":l.token_id,"price":l.price}));
    }
    fn close_raid(&mut self,id:&String,success:bool,recovered:Vec<String>){
        let before=env::storage_usage();
        let mut raid=self.raids.get(id).expect("Unknown raid");require!(!raid.settled,"Raid already settled");require!(success||recovered.is_empty(),"Failed raids cannot recover loot");
        let set:std::collections::BTreeSet<_>=recovered.iter().collect();require!(set.len()==recovered.len()&&recovered.iter().all(|id|raid.loot.iter().any(|l|&l.token_id==id)),"Invalid recovered loot");
        self.reservations.remove(&raid.weapon);
        if !success{self.transfer(&raid.player,&env::current_account_id(),&raid.weapon,1,Some("raid loss".into()));}
        for loot in &raid.loot{self.reservations.remove(&loot.token_id);let to=if set.contains(&loot.token_id){&raid.player}else{&loot.return_to};if *to!=env::current_account_id(){self.transfer(&env::current_account_id(),to,&loot.token_id,1,Some("raid outcome".into()));}}
        raid.settled=true;self.raids.insert(id,&raid);self.charge(&env::predecessor_account_id(),before);self.game_event("raid_settled",json!({"raid_id":id,"success":success,"player":raid.player,"recovered":recovered}));
    }
    fn emit(&self,event:&str,data:Value){env::log_str(&format!("EVENT_JSON:{}",json!({"standard":"nep245","version":"1.0.0","event":event,"data":[data]})));}
    fn game_event(&self,event:&str,data:Value){env::log_str(&format!("EVENT_JSON:{}",json!({"standard":"aftermarket","version":"1.0.0","event":event,"data":[data]})));}
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::{test_utils::VMContextBuilder, testing_env, NearToken,PromiseResult};
    fn id(s:&str)->AccountId{s.parse().unwrap()}
    fn context(who:&str,height:u64,deposit:u128){let mut b=VMContextBuilder::new();b.current_account_id(id("game.testnet")).predecessor_account_id(id(who)).signer_account_id(id(who)).block_height(height).attached_deposit(NearToken::from_yoctonear(deposit));testing_env!(b.build());}
    fn fixture()->Contract{context("owner.testnet",1,0);let mut c=Contract::new(id("owner.testnet"),id("operator.testnet"));for a in ["owner.testnet","operator.testnet","alice.testnet","npc.testnet","game.testnet"]{context(a,1,10u128.pow(24));c.fund_storage(None);}context("operator.testnet",2,0);c.mint(id("alice.testnet"),"R-042".into(),U128(1),Some("rifle".into()),Some(73));c.mint(id("npc.testnet"),"credit".into(),U128(900),None,None);context("owner.testnet",2,0);c.set_npc_budget(id("npc.testnet"),U128(600));c}
    #[test]
    fn rifle_circulation_and_budget(){let mut c=fixture();context("alice.testnet",3,0);let l=c.list_weapon("R-042".into(),U128(200),U64(50));context("operator.testnet",4,0);c.fill_listing_for_npc(l,id("npc.testnet"),U128(200));assert_eq!(c.balance(&id("alice.testnet"),"credit"),200);assert_eq!(c.npc_budget(id("npc.testnet")).unwrap().0,400);assert_eq!(c.mt_token(vec!["R-042".into()])[0].as_ref().unwrap().owner_id,Some(id("npc.testnet")));c.mint(id("alice.testnet"),"P-001".into(),U128(1),Some("pistol".into()),None);context("alice.testnet",5,0);c.begin_raid("raid-1".into(),"P-001".into(),U64(100));context("operator.testnet",6,0);c.assign_raid_loot("raid-1".into(),"R-042".into(),id("npc.testnet"));c.settle_raid("raid-1".into(),true,vec!["R-042".into()]);assert_eq!(c.balance(&id("alice.testnet"),"R-042"),1);assert_eq!(c.balance(&id("npc.testnet"),"R-042"),0);assert!(c.get_raid("raid-1".into()).unwrap().settled);}
    #[test]
    fn cancellation_and_expiry(){let mut c=fixture();context("alice.testnet",3,0);let l=c.list_weapon("R-042".into(),U128(200),U64(5));context("npc.testnet",6,0);c.cancel_listing(l);assert_eq!(c.balance(&id("alice.testnet"),"R-042"),1);assert!(c.reservation("R-042".into()).is_none());context("alice.testnet",7,0);c.begin_raid("expired".into(),"R-042".into(),U64(10));context("npc.testnet",11,0);c.expire_raid("expired".into());assert_eq!(c.balance(&id("game.testnet"),"R-042"),1);assert!(c.get_raid("expired".into()).unwrap().settled);}
    #[test]
    fn batch_and_supply_views(){let mut c=fixture();context("alice.testnet",3,1);c.mt_batch_transfer(id("npc.testnet"),vec!["R-042".into()],vec![U128(1)],None,None);assert_eq!(c.mt_balance_of(id("npc.testnet"),"R-042".into()).0,1);assert_eq!(c.mt_supply("R-042".into()).unwrap().0,1);assert!(c.mt_token(vec!["unknown".into()])[0].is_none());}

    #[test]
    #[should_panic(expected="NPC spending limit")]
    fn delegated_budget_cannot_be_exceeded(){let mut c=fixture();context("alice.testnet",3,0);let l=c.list_weapon("R-042".into(),U128(700),U64(100));context("operator.testnet",4,0);c.fill_listing_for_npc(l,id("npc.testnet"),U128(700));}

    #[test]
    #[should_panic(expected="Token is reserved")]
    fn raid_weapon_cannot_be_transferred(){let mut c=fixture();context("alice.testnet",3,0);c.begin_raid("locked".into(),"R-042".into(),U64(100));context("alice.testnet",4,1);c.mt_transfer(id("npc.testnet"),"R-042".into(),U128(1),None,None);}

    #[test]
    #[should_panic(expected="Raid already settled")]
    fn duplicate_raid_settlement_is_rejected(){let mut c=fixture();context("alice.testnet",3,0);c.begin_raid("once".into(),"R-042".into(),U64(100));context("operator.testnet",4,0);c.settle_raid("once".into(),true,vec![]);c.settle_raid("once".into(),true,vec![]);}

    #[test]
    #[should_panic(expected="Raid expired")]
    fn late_results_do_not_reopen_an_expired_raid(){let mut c=fixture();context("alice.testnet",3,0);c.begin_raid("late".into(),"R-042".into(),U64(5));context("operator.testnet",6,0);c.settle_raid("late".into(),true,vec![]);}

    #[test]
    #[should_panic(expected="Operator only")]
    fn players_cannot_mint_themselves_credits(){let mut c=fixture();context("alice.testnet",3,0);c.mint(id("alice.testnet"),"credit".into(),U128(10000),None,None);}

    #[test]
    fn failed_receiver_refunds_tokens(){let mut c=fixture();context("alice.testnet",3,1);c.mt_transfer_call(id("npc.testnet"),"R-042".into(),U128(1),None,None,"test".into());let mut b=VMContextBuilder::new();b.current_account_id(id("game.testnet")).predecessor_account_id(id("game.testnet")).block_height(4);testing_env!(b.build(),near_sdk::test_vm_config(),near_sdk::RuntimeFeesConfig::test(),Default::default(),vec![PromiseResult::Failed]);let used=c.mt_resolve_transfer(id("alice.testnet"),id("npc.testnet"),vec!["R-042".into()],vec![U128(1)]);assert_eq!(used[0].0,0);assert_eq!(c.balance(&id("alice.testnet"),"R-042"),1);assert_eq!(c.balance(&id("npc.testnet"),"R-042"),0);}

    #[test]
    fn partial_callback_refund_conserves_stack_supply(){let mut c=fixture();context("npc.testnet",3,1);c.mt_transfer_call(id("alice.testnet"),"credit".into(),U128(100),None,None,"test".into());let mut b=VMContextBuilder::new();b.current_account_id(id("game.testnet")).predecessor_account_id(id("game.testnet")).block_height(4);testing_env!(b.build(),near_sdk::test_vm_config(),near_sdk::RuntimeFeesConfig::test(),Default::default(),vec![PromiseResult::Successful(br#"["40"]"#.to_vec())]);let used=c.mt_resolve_transfer(id("npc.testnet"),id("alice.testnet"),vec!["credit".into()],vec![U128(100)]);assert_eq!(used[0].0,60);assert_eq!(c.balance(&id("alice.testnet"),"credit"),60);assert_eq!(c.balance(&id("npc.testnet"),"credit"),840);assert_eq!(c.mt_supply("credit".into()).unwrap().0,900);}
}
