import { SEED_PROJECT } from '@lightdash/common';

describe('Dashboard', () => {
    before(() => {
        cy.login();
    });

    beforeEach(() => {
        Cypress.Cookies.preserveOnce('connect.sid');
    });

    it('Should see dashboard', () => {
        cy.visit(`/projects/${SEED_PROJECT.project_uuid}/dashboards`);

        // wiat for the dashboard to load
        cy.findByText('Loading dashboards').should('not.exist');

        cy.contains('a', 'Jaffle dashboard').click();

        cy.findByText("What's our total revenue to date?");
        cy.findByText("What's the average spend per customer?");

        cy.findAllByText('Loading chart').should('have.length', 0); // Finish loading

        cy.findAllByText('No chart available').should('have.length', 0);
        cy.findAllByText('No data available').should('have.length', 0);

        cy.get('.echarts-for-react').should('have.length', 3); // Charts
        cy.contains('Payments total revenue'); // BigNumber chart
        cy.get('thead th').should('have.length', 6); // Table chart
    });

    it('Should create dashboard with tiles', () => {
        cy.visit(`/projects/${SEED_PROJECT.project_uuid}/dashboards`);

        cy.contains('Create dashboard').click();

        cy.findByText('Edit dashboard').click();

        cy.findByText('Add tile').click();
        cy.findByText('Saved chart').click();
        cy.findByText('Select saved charts').parent().find('input').click();
        cy.contains('How much revenue').click();
        cy.findByText('Add').click();

        cy.findByText('Add tile').click();
        cy.findByText('Markdown').click();
        cy.findByLabelText('Title').type('Title');
        cy.get('textarea').type('Content');
        cy.findByText('Add').click();

        cy.findByText('Add tile').click();
        cy.findByText('Loom video').click();

        cy.findByLabelText('Title *').type('Title');
        cy.findByLabelText('Loom url *').type(
            'https://www.loom.com/share/12345',
        );
        cy.findByText('Add').click();

        cy.findByText('Save').click();

        cy.contains('Dashboard was updated');

        cy.findAllByText('Loading chart').should('have.length', 0); // Finish loading
        cy.findAllByText('No chart available').should('have.length', 0);
        cy.findAllByText('No data available').should('have.length', 0);
    });
});
