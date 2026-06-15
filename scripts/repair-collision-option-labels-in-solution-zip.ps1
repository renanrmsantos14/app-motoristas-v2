param(
  [Parameter(Mandatory = $true)]
  [string]$SolutionZip,

  [string]$OutputZip = "",

  [int]$LanguageCode = 1046
)

$ErrorActionPreference = "Stop"

$labelsByAttribute = @{
  "cr40f_status" = @{
    "100000000" = "Pendente"
    "100000001" = "Enviado"
    "100000002" = "Falhou"
    "100000003" = "Invalido"
  }
  "cr40f_tipo" = @{
    "100000000" = "Cena"
    "100000001" = "Dano Betinhos"
    "100000002" = "Dano terceiro"
    "100000003" = "Documento/placa"
    "100000004" = "Extra"
  }
}

function Get-AttrValue($node, [string]$name) {
  if ($null -eq $node -or $null -eq $node.Attributes) { return "" }
  foreach ($attr in $node.Attributes) {
    if ([string]::Equals([string]$attr.Name, $name, [System.StringComparison]::OrdinalIgnoreCase)) {
      return [string]$attr.Value
    }
  }
  return ""
}

function Get-ChildText($node, [string]$localName) {
  foreach ($child in $node.ChildNodes) {
    if ([string]::Equals([string]$child.LocalName, $localName, [System.StringComparison]::OrdinalIgnoreCase) -or
        [string]::Equals([string]$child.Name, $localName, [System.StringComparison]::OrdinalIgnoreCase)) {
      return ([string]$child.InnerText).Trim()
    }
  }
  return ""
}

function Ensure-OptionLabel($xml, $optionNode, [string]$text, [int]$languageCode) {
  $labelsNode = $null
  foreach ($child in $optionNode.ChildNodes) {
    if ([string]::Equals([string]$child.Name, "labels", [System.StringComparison]::OrdinalIgnoreCase)) {
      $labelsNode = $child
      break
    }
  }

  if ($null -eq $labelsNode) {
    $labelsNode = $xml.CreateElement("labels")
    [void]$optionNode.AppendChild($labelsNode)
  }

  $labelNode = $null
  foreach ($child in $labelsNode.ChildNodes) {
    if (-not [string]::Equals([string]$child.Name, "label", [System.StringComparison]::OrdinalIgnoreCase)) { continue }
    if ((Get-AttrValue $child "languagecode") -eq [string]$languageCode) {
      $labelNode = $child
      break
    }
  }

  if ($null -eq $labelNode) {
    $labelNode = $xml.CreateElement("label")
    $languageAttr = $xml.CreateAttribute("languagecode")
    $languageAttr.Value = [string]$languageCode
    [void]$labelNode.Attributes.Append($languageAttr)
    [void]$labelsNode.AppendChild($labelNode)
  }

  $description = Get-AttrValue $labelNode "description"
  if ([string]::IsNullOrWhiteSpace($description)) {
    $descriptionAttr = $labelNode.Attributes.GetNamedItem("description")
    if ($null -eq $descriptionAttr) {
      $descriptionAttr = $xml.CreateAttribute("description")
      [void]$labelNode.Attributes.Append($descriptionAttr)
    }
    $descriptionAttr.Value = $text
    return $true
  }

  return $false
}

if (-not (Test-Path -LiteralPath $SolutionZip)) {
  throw "Solution zip nao encontrado: $SolutionZip"
}

$resolvedInput = (Resolve-Path -LiteralPath $SolutionZip).Path
if (-not $OutputZip) {
  $baseName = [IO.Path]::GetFileNameWithoutExtension($resolvedInput)
  $OutputZip = Join-Path (Resolve-Path ".\tmp").Path "$baseName.labels-fixed.zip"
}

$resolvedOutputDir = Split-Path -Parent $OutputZip
if ($resolvedOutputDir -and -not (Test-Path -LiteralPath $resolvedOutputDir)) {
  New-Item -ItemType Directory -Path $resolvedOutputDir | Out-Null
}

$workDir = Join-Path $env:TEMP ("solution-label-repair-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $workDir | Out-Null

try {
  Expand-Archive -LiteralPath $resolvedInput -DestinationPath $workDir -Force
  $customizations = Get-ChildItem -LiteralPath $workDir -Recurse -Filter "customizations.xml" | Select-Object -First 1
  if (-not $customizations) { throw "customizations.xml nao encontrado dentro do zip." }

  $xml = New-Object System.Xml.XmlDocument
  $xml.PreserveWhitespace = $true
  $xml.Load($customizations.FullName)

  $patched = New-Object System.Collections.Generic.List[object]
  $entityNodes = $xml.SelectNodes("//*[translate(local-name(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')='entity']")

  foreach ($entity in $entityNodes) {
    $entityName = Get-AttrValue $entity "Name"
    if (-not $entityName) { $entityName = Get-ChildText $entity "Name" }
    if ($entityName.ToLowerInvariant() -ne "cr40f_anexocolisao") { continue }

    $attributes = $entity.SelectNodes(".//*[translate(local-name(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')='attribute']")
    foreach ($attribute in $attributes) {
      $logicalName = (Get-ChildText $attribute "LogicalName").ToLowerInvariant()
      if (-not $logicalName) { $logicalName = (Get-AttrValue $attribute "PhysicalName").ToLowerInvariant() }
      if (-not $labelsByAttribute.ContainsKey($logicalName)) { continue }

      $optionMap = $labelsByAttribute[$logicalName]
      $options = $attribute.SelectNodes(".//*[translate(local-name(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')='option']")
      foreach ($option in $options) {
        $value = Get-AttrValue $option "value"
        if (-not $optionMap.ContainsKey($value)) { continue }

        $changed = Ensure-OptionLabel $xml $option $optionMap[$value] $LanguageCode
        if ($changed) {
          $patched.Add([pscustomobject]@{
            entity = "cr40f_anexocolisao"
            attribute = $logicalName
            optionValue = $value
            label = $optionMap[$value]
          })
        }
      }
    }
  }

  if ($patched.Count -eq 0) {
    Write-Warning "Nenhum label foi alterado. O ZIP pode ja estar corrigido ou a estrutura mudou."
  }

  $xml.Save($customizations.FullName)
  $xml = $null
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()

  if (Test-Path -LiteralPath $OutputZip) {
    Remove-Item -LiteralPath $OutputZip -Force
  }

  $items = Get-ChildItem -LiteralPath $workDir -Force
  Compress-Archive -LiteralPath $items.FullName -DestinationPath $OutputZip -Force

  [pscustomobject]@{
    input = $resolvedInput
    output = (Resolve-Path -LiteralPath $OutputZip).Path
    patchedCount = $patched.Count
    patched = $patched.ToArray()
  } | ConvertTo-Json -Depth 5
}
finally {
  if (Test-Path -LiteralPath $workDir) {
    Remove-Item -LiteralPath $workDir -Recurse -Force
  }
}
