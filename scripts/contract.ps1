param([ValidateSet('build','test')][string]$Action='test')
$ErrorActionPreference='Stop'
$cargoCommand=Get-Command cargo -ErrorAction SilentlyContinue
$cargoPath=if($cargoCommand){$cargoCommand.Source}else{Join-Path $env:USERPROFILE '.cargo\bin\cargo.exe'}
if(-not(Test-Path -LiteralPath $cargoPath)){throw 'Install Rust with rustup and add the wasm32-unknown-unknown target first.'}
$workspacePath=Split-Path -Parent $PSScriptRoot
$manifestPath=Join-Path $workspacePath 'contracts\economy\Cargo.toml'
if($Action -eq 'test'){
  # The dependency ships official Windows assembly objects; no separate NASM install is required.
  $env:AWS_LC_SYS_PREBUILT_NASM='1'
  & $cargoPath test --manifest-path $manifestPath --locked
}else{
  & $cargoPath build --manifest-path $manifestPath --target wasm32-unknown-unknown --release --locked
}
exit $LASTEXITCODE
