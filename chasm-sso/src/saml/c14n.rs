// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

//! Exclusive XML Canonicalization (`xml-exc-c14n#`).
//!
//! This produces the byte sequence a signer hashed. If it disagrees with the
//! signer's implementation by one space, every signature fails; if it is too
//! *forgiving*, signatures verify that should not. It is the most delicate
//! code in this crate and the reason [`super`] refuses so much.
//!
//! What "exclusive" means, and why SAML uses it: inclusive c14n pulls every
//! in-scope namespace declaration onto the top of the serialised fragment,
//! so a signed assertion breaks the moment it is moved into a response that
//! declares namespaces differently. Exclusive c14n emits only the namespaces
//! the fragment *visibly uses*, which is what makes a signed assertion
//! survive being embedded in someone else's document.
//!
//! Implemented from the W3C Exclusive XML Canonicalization 1.0
//! recommendation. The rules that matter here:
//!
//! * Elements and attributes are serialised in document order.
//! * Namespace declarations come before attributes; both sort by name, with
//!   namespaces ordered by prefix and attributes by (namespace URI, local).
//! * A namespace is emitted only if the element or one of its attributes
//!   visibly uses that prefix, or the prefix appears in `InclusiveNamespaces
//!   PrefixList`.
//! * A namespace is omitted if an ancestor already emitted the identical
//!   declaration in the output.
//! * Attribute values and text get the standard character escaping; notably
//!   `\r` becomes `&#xD;` so line-ending rewriting cannot change the digest.
//! * Comments are dropped (the `#WithComments` variant is not supported).

use std::collections::BTreeMap;

/// Canonicalise `node` and everything under it.
///
/// `inclusive_prefixes` is the `PrefixList` from an `InclusiveNamespaces`
/// transform, if the signature carried one.
pub fn canonicalize(node: roxmltree::Node, inclusive_prefixes: &[String]) -> String {
    let mut out = String::new();
    // Namespace declarations already emitted by an ancestor, so we do not
    // repeat them.
    let rendered: Vec<(String, String)> = Vec::new();
    write_node(node, &mut out, &rendered, inclusive_prefixes, None);
    out
}

/// Canonicalise `node`, omitting `exclude` and everything under it.
///
/// This is the enveloped-signature transform: the signature cannot cover
/// itself, so it is removed before the digest is computed. Forgetting this
/// makes every digest wrong, which at least fails safe -- but it fails
/// mysteriously, so it is worth naming.
pub fn canonicalize_without(
    node: roxmltree::Node,
    exclude: roxmltree::Node,
    inclusive_prefixes: &[String],
) -> String {
    let mut out = String::new();
    let rendered: Vec<(String, String)> = Vec::new();
    write_node(node, &mut out, &rendered, inclusive_prefixes, Some(exclude));
    out
}

fn write_node(
    node: roxmltree::Node,
    out: &mut String,
    rendered: &[(String, String)],
    inclusive: &[String],
    exclude: Option<roxmltree::Node>,
) {
    if let Some(ex) = exclude {
        if node == ex {
            return;
        }
    }
    match node.node_type() {
        roxmltree::NodeType::Element => write_element(node, out, rendered, inclusive, exclude),
        roxmltree::NodeType::Text => {
            out.push_str(&escape_text(node.text().unwrap_or_default()));
        }
        roxmltree::NodeType::PI => {
            out.push_str("<?");
            out.push_str(node.pi().map(|p| p.target).unwrap_or_default());
            if let Some(value) = node.pi().and_then(|p| p.value) {
                out.push(' ');
                out.push_str(value);
            }
            out.push_str("?>");
        }
        // Comments are not part of the canonical form we sign over.
        roxmltree::NodeType::Comment | roxmltree::NodeType::Root => {
            for child in node.children() {
                write_node(child, out, rendered, inclusive, exclude);
            }
        }
    }
}

fn write_element(
    node: roxmltree::Node,
    out: &mut String,
    rendered: &[(String, String)],
    inclusive: &[String],
    exclude: Option<roxmltree::Node>,
) {
    let name = qualified_name(node);
    out.push('<');
    out.push_str(&name);

    // Which prefixes this element visibly uses: its own, plus each attribute's.
    let mut needed: BTreeMap<String, String> = BTreeMap::new();

    let element_prefix = node.tag_name().namespace().map(|_| prefix_of(node));
    if let Some(prefix) = element_prefix {
        if let Some(uri) = node.tag_name().namespace() {
            needed.insert(prefix, uri.to_string());
        }
    }

    for attr in node.attributes() {
        // Unprefixed attributes are in no namespace and pull nothing in.
        if let Some(uri) = attr.namespace() {
            let prefix = attribute_prefix(node, attr, uri);
            needed.insert(prefix, uri.to_string());
        }
    }

    // PrefixList forces declarations in even when unused, which is how a
    // signer keeps a fragment verifiable in contexts it cannot predict.
    for prefix in inclusive {
        let lookup = if prefix == "#default" {
            ""
        } else {
            prefix.as_str()
        };
        if let Some(uri) = node
            .namespaces()
            .find(|ns| ns.name().unwrap_or("") == lookup)
            .map(|ns| ns.uri())
        {
            needed.insert(lookup.to_string(), uri.to_string());
        }
    }

    // Emit only what an ancestor has not already emitted identically.
    let mut emitted = rendered.to_vec();
    let mut to_render: Vec<(String, String)> = Vec::new();
    for (prefix, uri) in needed {
        let already = emitted.iter().any(|(p, u)| p == &prefix && u == &uri);
        if !already {
            to_render.push((prefix.clone(), uri.clone()));
            emitted.push((prefix, uri));
        }
    }
    // Namespace axis sorts by prefix, with the default namespace first.
    to_render.sort_by(|a, b| a.0.cmp(&b.0));

    for (prefix, uri) in &to_render {
        if prefix.is_empty() {
            out.push_str(" xmlns=\"");
        } else {
            out.push_str(" xmlns:");
            out.push_str(prefix);
            out.push_str("=\"");
        }
        out.push_str(&escape_attr(uri));
        out.push('"');
    }

    // Attributes sort by namespace URI then local name; unnamespaced first.
    let mut attrs: Vec<_> = node.attributes().collect();
    attrs.sort_by(|a, b| {
        let ka = (a.namespace().unwrap_or(""), a.name());
        let kb = (b.namespace().unwrap_or(""), b.name());
        ka.cmp(&kb)
    });
    for attr in attrs {
        out.push(' ');
        if let Some(uri) = attr.namespace() {
            let prefix = attribute_prefix(node, attr, uri);
            if !prefix.is_empty() {
                out.push_str(&prefix);
                out.push(':');
            }
        }
        out.push_str(attr.name());
        out.push_str("=\"");
        out.push_str(&escape_attr(attr.value()));
        out.push('"');
    }
    out.push('>');

    for child in node.children() {
        write_node(child, out, &emitted, inclusive, exclude);
    }

    out.push_str("</");
    out.push_str(&name);
    out.push('>');
}

/// `prefix:local`, or just `local` when the element is unprefixed.
fn qualified_name(node: roxmltree::Node) -> String {
    let local = node.tag_name().name();
    match node.tag_name().namespace() {
        Some(_) => {
            let prefix = prefix_of(node);
            if prefix.is_empty() {
                local.to_string()
            } else {
                format!("{prefix}:{local}")
            }
        }
        None => local.to_string(),
    }
}

/// The prefix an element is written with in the source document.
fn prefix_of(node: roxmltree::Node) -> String {
    let uri = node.tag_name().namespace().unwrap_or("");
    node.namespaces()
        .find(|ns| ns.uri() == uri)
        .and_then(|ns| ns.name())
        .unwrap_or("")
        .to_string()
}

fn attribute_prefix(node: roxmltree::Node, attr: roxmltree::Attribute, uri: &str) -> String {
    let _ = attr;
    node.namespaces()
        .find(|ns| ns.uri() == uri)
        .and_then(|ns| ns.name())
        .unwrap_or("")
        .to_string()
}

/// Text escaping per the canonical form.
///
/// `\r` must become `&#xD;`: otherwise a transport that rewrites line endings
/// silently changes the digest, and a signature that was valid stops being so
/// (or, worse, a document can be mutated without changing its digest).
fn escape_text(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '\r' => out.push_str("&#xD;"),
            _ => out.push(c),
        }
    }
    out
}

fn escape_attr(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '"' => out.push_str("&quot;"),
            '\t' => out.push_str("&#x9;"),
            '\n' => out.push_str("&#xA;"),
            '\r' => out.push_str("&#xD;"),
            _ => out.push(c),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn c14n(xml: &str) -> String {
        let doc = roxmltree::Document::parse(xml).expect("parse");
        canonicalize(doc.root_element(), &[])
    }

    #[test]
    fn attributes_are_sorted_and_quoted_consistently() {
        // Source order b, a -- canonical order a, b.
        let out = c14n(r#"<r b='2' a='1'/>"#);
        assert_eq!(out, r#"<r a="1" b="2"></r>"#);
    }

    #[test]
    fn empty_elements_get_explicit_end_tags() {
        assert_eq!(c14n("<r/>"), "<r></r>");
    }

    #[test]
    fn comments_are_dropped() {
        assert_eq!(c14n("<r><!-- gone -->text</r>"), "<r>text</r>");
    }

    /// The escaping that matters: a carriage return has to survive as an
    /// entity, or line-ending rewriting changes the digest.
    #[test]
    fn carriage_returns_are_escaped_in_text_and_attributes() {
        let doc = roxmltree::Document::parse("<r a=\"x&#xD;y\">p&#xD;q</r>").unwrap();
        let out = canonicalize(doc.root_element(), &[]);
        assert!(out.contains("&#xD;"), "{out}");
        assert!(!out.contains('\r'), "raw CR survived: {out:?}");
    }

    #[test]
    fn markup_characters_are_escaped() {
        assert_eq!(c14n("<r>a &lt; b &amp; c</r>"), "<r>a &lt; b &amp; c</r>");
        let out = c14n(r#"<r a="&quot;q&quot;"/>"#);
        assert!(out.contains("&quot;"), "{out}");
    }

    /// Exclusive c14n emits only namespaces the fragment visibly uses. The
    /// unused `xmlns:unused` must not appear, and that is the whole point of
    /// "exclusive".
    #[test]
    fn unused_namespaces_are_not_emitted() {
        let xml = r#"<a:r xmlns:a="urn:a" xmlns:unused="urn:zzz"><a:c/></a:r>"#;
        let out = c14n(xml);
        assert!(out.contains("urn:a"), "{out}");
        assert!(!out.contains("urn:zzz"), "unused namespace leaked: {out}");
    }

    #[test]
    fn a_namespace_is_declared_once_not_on_every_descendant() {
        let xml = r#"<a:r xmlns:a="urn:a"><a:c><a:d/></a:c></a:r>"#;
        let out = c14n(xml);
        assert_eq!(out.matches("xmlns:a=").count(), 1, "{out}");
    }

    #[test]
    fn document_order_is_preserved() {
        let out = c14n("<r><one/><two/><three/></r>");
        assert_eq!(out, "<r><one></one><two></two><three></three></r>");
    }

    /// Two documents differing only in ignorable-looking ways must produce
    /// different bytes when the difference is real, and identical bytes when
    /// it is only attribute order.
    #[test]
    fn canonical_form_is_stable_across_attribute_order() {
        assert_eq!(c14n(r#"<r a="1" b="2"/>"#), c14n(r#"<r b="2" a="1"/>"#));
        assert_ne!(c14n(r#"<r a="1"/>"#), c14n(r#"<r a="2"/>"#));
    }
}
