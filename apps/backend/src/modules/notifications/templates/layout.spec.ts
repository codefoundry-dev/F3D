import * as fs from 'fs';
import * as path from 'path';

import * as Handlebars from 'handlebars';

/**
 * FOR-288: the shared email layout renders the issuing company's branding. This
 * compiles the REAL layout.html with real Handlebars (no mocks) to lock in that a
 * branded email shows the company logo AND its name as a visible line, and that an
 * unbranded email shows neither.
 */
describe('email layout branding (FOR-288)', () => {
  const layoutSource = fs.readFileSync(path.join(__dirname, 'layout.html'), 'utf-8');
  const layout = Handlebars.compile(layoutSource);

  const baseVars = {
    content: '<p>Body</p>',
    footer: { privacyPolicy: 'Privacy policy', and: 'and', termsOfService: 'Terms of service' },
  };

  it('renders the company logo and the company name when a brand is provided', () => {
    const html = layout({
      ...baseVars,
      brand: { name: 'Acme Builders', logoUrl: 'https://cdn.test/acme.png' },
    });

    // Logo <img> pointing at the presigned URL, with the name as alt text.
    expect(html).toContain('src="https://cdn.test/acme.png"');
    expect(html).toContain('alt="Acme Builders"');
    // The company name is also rendered as a visible text line (not only alt text).
    expect(html).toMatch(/<div[^>]*>\s*Acme Builders\s*<\/div>/);
  });

  it('renders the company name without an image when the brand has no logo (FOR-383)', () => {
    const html = layout({ ...baseVars, brand: { name: 'Acme Builders' } });

    expect(html).not.toContain('<img');
    expect(html).toMatch(/<div[^>]*>\s*Acme Builders\s*<\/div>/);
  });

  it('renders neither logo nor name line when no brand is provided', () => {
    const html = layout(baseVars);

    expect(html).not.toContain('<img');
    expect(html).not.toContain('Acme Builders');
  });
});
