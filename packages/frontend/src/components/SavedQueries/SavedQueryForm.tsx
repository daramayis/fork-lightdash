import { Classes } from '@blueprintjs/core';
import { SpaceQuery } from '@lightdash/common';
import { FC } from 'react';
import { useSavedQuery } from '../../hooks/useSavedQuery';
import { ActionModalProps, ActionTypeModal } from '../common/modal/ActionModal';
import Input from '../ReactHookForm/Input';

type SavedQueryFormProps = Pick<
    ActionModalProps<SpaceQuery>,
    'useActionModalState' | 'isDisabled'
>;

const SavedQueryForm: FC<SavedQueryFormProps> = ({
    useActionModalState,
    isDisabled,
}) => {
    const [{ actionType, data }] = useActionModalState;
    const { data: savedChart } = useSavedQuery({
        id: data?.uuid,
    });

    return (
        <>
            {actionType === ActionTypeModal.UPDATE && (
                <div className={Classes.DIALOG_BODY}>
                    <Input
                        label="Enter a memorable name for your chart"
                        name="name"
                        placeholder="eg. How many weekly active users do we have?"
                        disabled={isDisabled}
                        rules={{ required: 'Name field is required' }}
                        defaultValue={data?.name || ''}
                    />

                    <Input
                        label="Chart description"
                        name="description"
                        placeholder="A few words to give your team some context"
                        disabled={isDisabled}
                        defaultValue={savedChart?.description || ''}
                    />
                </div>
            )}

            {actionType === ActionTypeModal.DELETE && (
                <p>Are you sure you want to delete this chart ?</p>
            )}
        </>
    );
};

export default SavedQueryForm;
