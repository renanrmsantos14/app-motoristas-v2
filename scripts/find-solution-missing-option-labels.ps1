param(
  [Parameter(Mandatory = $true)]
  [string]$SolutionZip,

  [string]$EntityLogicalName = "cr40f_anexocolisao",

  [int]$BaseLanguage = 1046,

  [string]$ProblemId = "3d731536-aa1a-4090-b20d-0cb6f7cefdf5"
)

$ErrorActionPreference = "Stop"

function Get-NodeName($node) {
  if ($null -eq $node) { return "" }
  if ($node.LocalName) { return [string]$node.LocalName }
  return [string]$node.Name
}

function Get-Attr($node, [string[]]$names) {
  if ($null -eq $node -or $null -eq $node.Attributes) { return "" }
  foreach ($name in $names) {
    foreach ($attr in $node.Attributes) {
      if ([string]::Equals([string]$attr.Name, $name, [System.StringComparison]::OrdinalIgnoreCase) -or
          [string]::Equals([string]$attr.LocalName, $name, [System.StringComparison]::OrdinalIgnoreCase)) {
        return [string]$attr.Value
      }
    }
  }
  return ""
}

function Get-ChildText($node, [string[]]$names) {
  if ($null -eq $node) { return "" }
  foreach ($child in $node.ChildNodes) {
    $local = (Get-NodeName $child).ToLowerInvariant()
    if ($names -contains $local) {
      return ([string]$child.InnerText).Trim()
    }
  }
  return ""
}

function Get-NearestAttributeLogicalName($node) {
  $current = $node
  while ($current) {
    $name = (Get-NodeName $current).ToLowerInvariant()
    if ($name -in @("attribute", "attributemetadata")) {
      $value = Get-Attr $current @("PhysicalName", "physicalname", "LogicalName", "logicalname", "Name", "name")
      if ($value) { return $value }
      $value = Get-ChildText $current @("logicalname", "name")
      if ($value) { return $value }
    }
    $current = $current.ParentNode
  }
  return ""
}

function Get-NearestEntityLogicalName($node) {
  $current = $node
  while ($current) {
    $name = (Get-NodeName $current).ToLowerInvariant()
    if ($name -eq "entity") {
      $value = Get-Attr $current @("Name", "name", "LogicalName", "logicalname")
      if ($value) { return $value }
      $value = Get-ChildText $current @("name", "logicalname")
      if ($value) { return $value }
    }
    $current = $current.ParentNode
  }
  return ""
}

function Get-LabelRows($optionNode) {
  $rows = New-Object System.Collections.Generic.List[object]
  foreach ($desc in $optionNode.SelectNodes(".//*[translate(local-name(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')='label']")) {
    $text = Get-Attr $desc @("description", "Description", "label", "Label")
    if (-not $text) { $text = ([string]$desc.InnerText).Trim() }
    $language = Get-Attr $desc @("languagecode", "LanguageCode", "language", "Language")
    $rows.Add([pscustomobject]@{
      language = $language
      label = $text
    })
  }
  return $rows.ToArray()
}

function Get-OptionIdentifier($node) {
  $id = Get-Attr $node @("id", "Id", "metadataid", "MetadataId")
  if ($id) { return $id }
  foreach ($desc in $node.SelectNodes(".//*")) {
    $text = ([string]$desc.InnerText).Trim()
    if ($text -match "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$") {
      return $text
    }
  }
  return ""
}

function Test-IsOptionNode($node) {
  $name = (Get-NodeName $node).ToLowerInvariant()
  if ($name -notin @("option", "enumoption")) { return $false }
  $value = Get-Attr $node @("value", "Value")
  if ($value -ne "") { return $true }
  return ($node.SelectNodes(".//*[translate(local-name(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')='label']").Count -gt 0)
}

if (-not (Test-Path -LiteralPath $SolutionZip)) {
  throw "Solution zip nao encontrado: $SolutionZip"
}

$resolvedZip = (Resolve-Path -LiteralPath $SolutionZip).Path
$workDir = Join-Path $env:TEMP ("solution-label-audit-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $workDir | Out-Null

try {
  Expand-Archive -LiteralPath $resolvedZip -DestinationPath $workDir -Force
  $customizationsPath = Get-ChildItem -LiteralPath $workDir -Recurse -Filter "customizations.xml" | Select-Object -First 1
  if (-not $customizationsPath) {
    throw "customizations.xml nao encontrado dentro do zip."
  }

  $rawXml = Get-Content -LiteralPath $customizationsPath.FullName -Raw
  [xml]$xml = $rawXml

  $directProblemHits = New-Object System.Collections.Generic.List[object]
  if ($ProblemId) {
    $lines = $rawXml -split "`r?`n"
    for ($i = 0; $i -lt $lines.Count; $i++) {
      if ($lines[$i] -like "*$ProblemId*") {
        $directProblemHits.Add([pscustomobject]@{
          line = $i + 1
          text = $lines[$i].Trim()
        })
      }
    }
  }

  $problems = New-Object System.Collections.Generic.List[object]
  $optionsChecked = 0
  $allOptionNodes = $xml.SelectNodes("//*[translate(local-name(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')='option' or translate(local-name(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')='enumoption']")

  foreach ($option in $allOptionNodes) {
    if (-not (Test-IsOptionNode $option)) { continue }

    $entity = Get-NearestEntityLogicalName $option
    if ($EntityLogicalName -and $EntityLogicalName -ne "*" -and $entity -and $entity.ToLowerInvariant() -ne $EntityLogicalName.ToLowerInvariant()) {
      continue
    }

    $optionsChecked++
    $attribute = Get-NearestAttributeLogicalName $option
    $value = Get-Attr $option @("value", "Value")
    $id = Get-OptionIdentifier $option
    $labels = @(Get-LabelRows $option)
    $baseLabels = @($labels | Where-Object { [string]$_.language -eq [string]$BaseLanguage -and -not [string]::IsNullOrWhiteSpace($_.label) })
    $emptyLabels = @($labels | Where-Object { [string]::IsNullOrWhiteSpace($_.label) })

    $issues = New-Object System.Collections.Generic.List[string]
    if ($labels.Count -eq 0) { $issues.Add("sem nenhum label") }
    if ($baseLabels.Count -eq 0) { $issues.Add("sem label nao vazio no idioma base $BaseLanguage") }
    if ($emptyLabels.Count -gt 0) { $issues.Add("tem label vazio") }
    if ($ProblemId -and $id -eq $ProblemId) { $issues.Add("GUID bate com o erro do deploy") }

    if ($issues.Count -gt 0) {
      $problems.Add([pscustomobject]@{
        entity = $entity
        attribute = $attribute
        optionValue = $value
        optionId = $id
        issues = ($issues -join "; ")
        labels = (($labels | ForEach-Object { "$($_.language):$($_.label)" }) -join " | ")
      })
    }
  }

  $result = [pscustomobject]@{
    solutionZip = $resolvedZip
    customizationsXml = $customizationsPath.FullName
    entityFilter = $EntityLogicalName
    baseLanguage = $BaseLanguage
    problemId = $ProblemId
    directProblemHits = $directProblemHits.ToArray()
    optionsChecked = $optionsChecked
    problems = $problems.ToArray()
  }

  $result | ConvertTo-Json -Depth 6

  if ($problems.Count -gt 0 -or $directProblemHits.Count -gt 0) {
    exit 2
  }

  exit 0
}
finally {
  if (Test-Path -LiteralPath $workDir) {
    Remove-Item -LiteralPath $workDir -Recurse -Force
  }
}
