import { Button, NonIdealState, Spinner } from '@blueprintjs/core';
import { Breadcrumbs2 } from '@blueprintjs/popover2';
import { subject } from '@casl/ability';
import { LightdashMode } from '@lightdash/common';
import { FC } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import Page from '../components/common/Page/Page';
import {
    PageBreadcrumbsWrapper,
    PageContentWrapper,
    PageHeader,
} from '../components/common/Page/Page.styles';
import ResourceList from '../components/common/ResourceList';
import {
    ResourceBreadcrumbTitle,
    ResourceTag,
} from '../components/common/ResourceList/ResourceList.styles';
import { SortDirection } from '../components/common/ResourceList/ResourceTable';
import { useSavedCharts } from '../hooks/useSpaces';
import { useApp } from '../providers/AppProvider';

const SavedQueries: FC = () => {
    const { projectUuid } = useParams<{ projectUuid: string }>();
    const { isLoading, data: savedQueries = [] } = useSavedCharts(projectUuid);

    const { user, health } = useApp();
    const cannotView = user.data?.ability?.cannot('view', 'SavedChart');

    const history = useHistory();
    const isDemo = health.data?.mode === LightdashMode.DEMO;

    const userCanManageCharts = user.data?.ability?.can(
        'manage',
        subject('SavedChart', {
            organizationUuid: user.data?.organizationUuid,
            projectUuid,
        }),
    );

    if (isLoading && !cannotView) {
        return (
            <div style={{ marginTop: '20px' }}>
                <NonIdealState title="Loading charts" icon={<Spinner />} />
            </div>
        );
    }

    const handleCreateChart = () => {
        history.push(`/projects/${projectUuid}/tables`);
    };

    return (
        <Page>
            <PageContentWrapper>
                <PageHeader>
                    <PageBreadcrumbsWrapper>
                        <Breadcrumbs2
                            items={[
                                {
                                    href: '/home',
                                    text: 'Home',
                                    className: 'home-breadcrumb',
                                    onClick: (e) => {
                                        history.push('/home');
                                    },
                                },
                                {
                                    text: (
                                        <ResourceBreadcrumbTitle>
                                            All saved charts
                                            {savedQueries.length > 0 && (
                                                <ResourceTag round>
                                                    {savedQueries.length}
                                                </ResourceTag>
                                            )}
                                        </ResourceBreadcrumbTitle>
                                    ),
                                },
                            ]}
                        />
                    </PageBreadcrumbsWrapper>

                    {userCanManageCharts &&
                        !isDemo &&
                        savedQueries.length > 0 && (
                            <Button
                                text="Create chart"
                                icon="plus"
                                intent="primary"
                                onClick={handleCreateChart}
                            />
                        )}
                </PageHeader>

                <ResourceList
                    resourceIcon="chart"
                    resourceType="chart"
                    resourceList={savedQueries}
                    defaultSort={{
                        updatedAt: SortDirection.DESC,
                    }}
                    onClickCTA={
                        !isDemo && userCanManageCharts
                            ? handleCreateChart
                            : undefined
                    }
                    getURL={({ uuid }) =>
                        `/projects/${projectUuid}/saved/${uuid}`
                    }
                />
            </PageContentWrapper>
        </Page>
    );
};

export default SavedQueries;
